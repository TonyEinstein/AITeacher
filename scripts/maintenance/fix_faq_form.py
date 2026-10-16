# -*- coding: utf-8 -*-
import io

path = r'E:\AITeacher\docs\website\faq.html'
with io.open(path, 'r', encoding='utf-8') as f:
    content = f.read()

old = """// 表单提交
document.getElementById('contactForm').addEventListener('submit', function(e){
  e.preventDefault();
  this.style.display = 'none';
  document.getElementById('formSuccess').style.display = 'block';
});"""

new = """// 表单提交
document.getElementById('contactForm').addEventListener('submit', async function(e){
  e.preventDefault();
  const btn = this.querySelector('.btn-submit');
  btn.textContent = '提交中...';
  btn.disabled = true;
  try {
    const formData = new FormData(this);
    const payload = {
      name: formData.get('name') || '',
      phone: formData.get('phone') || '',
      company: formData.get('company') || '',
      message: formData.get('message') || '',
    };
    await fetch('http://127.0.0.1:3000/api/v1/leads/public', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch(err) { console.warn('提交失败:', err); }
  this.style.display = 'none';
  document.getElementById('formSuccess').style.display = 'block';
});"""

if old in content:
    content = content.replace(old, new)
    with io.open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print('✅ 官网表单提交已修复')
else:
    print('❌ 未找到目标代码')
