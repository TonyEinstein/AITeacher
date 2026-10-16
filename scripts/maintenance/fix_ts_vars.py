# -*- coding: utf-8 -*-
import io

# 修复 App.vue: 删除未使用的 className
p1 = r'E:\AITeacher\classroom-client\src\renderer\App.vue'
with io.open(p1, 'r', encoding='utf-8') as f:
    c = f.read()
c = c.replace("  const className = item.class?.name || '同学们';\n", '')
with io.open(p1, 'w', encoding='utf-8') as f:
    f.write(c)

# 修复 tts.ts: 用下划线前缀标记未使用变量
p2 = r'E:\AITeacher\classroom-client\src\renderer\utils\tts.ts'
with io.open(p2, 'r', encoding='utf-8') as f:
    c = f.read()
c = c.replace('private currentUtterance: SpeechSynthesisUtterance | null = null;', 'private _currentUtterance: SpeechSynthesisUtterance | null = null;')
c = c.replace('this.currentUtterance = utterance;', 'this._currentUtterance = utterance;')
c = c.replace('this.currentUtterance = null;', 'this._currentUtterance = null;')
c = c.replace('private isProcessing = false;', 'private _isProcessing = false;')
c = c.replace('this.isProcessing = true;', 'this._isProcessing = true;')
c = c.replace('this.isProcessing = false;', 'this._isProcessing = false;')
with io.open(p2, 'w', encoding='utf-8') as f:
    f.write(c)

print('已修复未使用变量')
