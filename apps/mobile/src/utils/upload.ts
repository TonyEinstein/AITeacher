import { ENV } from '@/config/env';
import { getToken } from '@/utils/auth';

interface UploadOptions {
  url: string;
  filePath: string;
  /** 后端接收的文件字段名，默认 file */
  name?: string;
  formData?: Record<string, any>;
  showError?: boolean;
}

/**
 * 统一上传（uni.uploadFile 内部已按端分发：
 * 微信小程序 -> wx.uploadFile / App -> plus.uploader / H5 -> XHR FormData）
 * 返回后端解包后的 data
 */
export function uploadFile(options: UploadOptions): Promise<any> {
  return new Promise((resolve, reject) => {
    uni.uploadFile({
      url: ENV.apiBase + options.url,
      filePath: options.filePath,
      name: options.name || 'file',
      formData: options.formData,
      header: { Authorization: 'Bearer ' + getToken() },
      success: (res) => {
        try {
          const body = JSON.parse(res.data as string);
          if (body && body.code === 0) {
            resolve(body.data);
          } else {
            const msg = body?.message || '上传失败';
            if (options.showError !== false) uni.showToast({ title: msg, icon: 'none' });
            reject(body);
          }
        } catch (e) {
          reject(res);
        }
      },
      fail: (err) => {
        if (options.showError !== false) {
          uni.showToast({ title: '上传失败，请检查网络', icon: 'none' });
        }
        reject(err);
      },
    });
  });
}
