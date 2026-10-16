# -*- coding: utf-8 -*-
import io
p = r'E:\AITeacher\classroom-client\src\renderer\utils\tts.ts'
with io.open(p, 'r', encoding='utf-8') as f:
    c = f.read()

# 删除 _currentUtterance 变量声明和所有赋值
c = c.replace('  private _currentUtterance: SpeechSynthesisUtterance | null = null;\n', '')
c = c.replace('    this._currentUtterance = utterance;\n', '')
c = c.replace('      this._currentUtterance = null;\n', '')

# 删除 _isProcessing 变量声明和所有赋值
c = c.replace('  private _isProcessing = false;\n', '')
c = c.replace('    this._isProcessing = true;\n', '')
c = c.replace('      this._isProcessing = false;\n', '')

with io.open(p, 'w', encoding='utf-8') as f:
    f.write(c)
print('已删除未使用变量')
