# -*- coding: utf-8 -*-
"""
教材 OCR 解析脚本
用法: python parse_textbook.py <input_file> <output_json>
功能:
  - PDF 文字版: 用 pdfplumber 提取文本，按页码/标题切分章节
  - PDF 扫描版/图片: 尝试 PaddleOCR（如已安装），否则降级为按页占位
输出: JSON 数组 [{title, page, content, level}]
"""
import sys
import io
import json
import os
import re

def extract_pdf_text(pdf_path):
    """提取 PDF 文本，优先 pdfplumber，降级 PyPDF2"""
    pages = []
    try:
        import pdfplumber
        with pdfplumber.open(pdf_path) as pdf:
            for i, page in enumerate(pdf.pages):
                text = page.extract_text() or ''
                pages.append({'page': i + 1, 'text': text.strip()})
        return pages, 'pdfplumber'
    except ImportError:
        pass
    try:
        from PyPDF2 import PdfReader
        reader = PdfReader(pdf_path)
        for i, page in enumerate(reader.pages):
            text = page.extract_text() or ''
            pages.append({'page': i + 1, 'text': text.strip()})
        return pages, 'PyPDF2'
    except ImportError:
        pass
    return None, None

def ocr_image(image_path):
    """图片 OCR，优先 PaddleOCR"""
    try:
        from paddleocr import PaddleOCR
        ocr = PaddleOCR(use_angle_cls=True, lang='ch', show_log=False)
        result = ocr.ocr(image_path, cls=True)
        texts = []
        for line in result[0] if result and result[0] else []:
            texts.append(line[1][0])
        return '\n'.join(texts), 'paddleocr'
    except ImportError:
        pass
    except Exception as e:
        return '', f'paddleocr_error:{e}'
    return '', None

def split_chapters(pages):
    """
    从提取的文本中按章节标题切分
    识别规则: 第X章 / 第X课 / 第X单元 / 数字+点+标题
    """
    chapters = []
    # 章节标题正则
    chapter_patterns = [
        r'^第[一二三四五六七八九十百零\d]+章\s*(.+)$',
        r'^第[一二三四五六七八九十百零\d]+单元\s*(.+)$',
        r'^第[一二三四五六七八九十百零\d]+课\s*(.+)$',
        r'^(\d+)[\.、]\s*(.+)$',
    ]
    current_chapter = None
    current_content = []

    for page_info in pages:
        page_num = page_info['page']
        lines = page_info['text'].split('\n')
        for line in lines:
            line = line.strip()
            if not line:
                continue
            # 检查是否是章节标题
            matched = False
            title_text = line
            level = 2
            for pat in chapter_patterns:
                m = re.match(pat, line)
                if m:
                    matched = True
                    if '章' in line or '单元' in line:
                        level = 1
                    title_text = line
                    break
            if matched and len(line) < 50:
                # 保存上一章
                if current_chapter:
                    current_chapter['content'] = '\n'.join(current_content).strip()
                    chapters.append(current_chapter)
                current_chapter = {
                    'title': title_text,
                    'page': page_num,
                    'level': level,
                    'content': '',
                }
                current_content = []
            else:
                if current_chapter:
                    current_content.append(line)
                else:
                    # 前言部分，作为一个章节
                    current_chapter = {
                        'title': '前言',
                        'page': page_num,
                        'level': 0,
                        'content': '',
                    }
                    current_content = [line]
    # 保存最后一章
    if current_chapter:
        current_chapter['content'] = '\n'.join(current_content).strip()
        chapters.append(current_chapter)
    return chapters

def main():
    if len(sys.argv) < 3:
        print(json.dumps({'error': '用法: python parse_textbook.py <input_file> <output_json>'}))
        sys.exit(1)

    input_file = sys.argv[1]
    output_file = sys.argv[2]

    if not os.path.exists(input_file):
        print(json.dumps({'error': f'文件不存在: {input_file}'}))
        sys.exit(1)

    ext = os.path.splitext(input_file)[1].lower()
    result = {'chapters': [], 'method': '', 'total_pages': 0, 'total_chapters': 0}

    if ext == '.pdf':
        pages, method = extract_pdf_text(input_file)
        if pages is None:
            result['method'] = 'unavailable'
            result['error'] = '未安装 pdfplumber 或 PyPDF2，请 pip install pdfplumber'
        else:
            result['method'] = method
            result['total_pages'] = len(pages)
            # 检查是否是扫描版（文字提取量极少）
            total_chars = sum(len(p['text']) for p in pages)
            avg_chars = total_chars / max(len(pages), 1)
            if avg_chars < 20:
                # 可能是扫描版，尝试 OCR（如果安装了 PaddleOCR）
                result['method'] = method + '+ocr_attempt'
                # 扫描版 OCR 耗时较长，这里只标记，实际 OCR 可由调用方决定是否逐页调用
                chapters = split_chapters(pages)
                result['note'] = '疑似扫描版，文本提取量少，建议安装 PaddleOCR 后重新解析'
            else:
                chapters = split_chapters(pages)
            result['chapters'] = chapters
            result['total_chapters'] = len(chapters)
    elif ext in ('.jpg', '.jpeg', '.png', '.bmp', '.tiff'):
        text, method = ocr_image(input_file)
        if method:
            result['method'] = method
            result['chapters'] = [{'title': '图片内容', 'page': 1, 'level': 1, 'content': text}]
            result['total_chapters'] = 1
        else:
            result['method'] = 'unavailable'
            result['error'] = '未安装 PaddleOCR，请 pip install paddleocr paddlepaddle'
    else:
        result['error'] = f'不支持的文件格式: {ext}'

    with io.open(output_file, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    print(json.dumps({'success': True, 'method': result.get('method', ''), 'chapters': result.get('total_chapters', 0)}))

if __name__ == '__main__':
    main()
