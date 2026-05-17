/**
 * 小程序入口文件
 * 负责全局生命周期管理和全局数据
 */
App({
  onLaunch() {
    console.log('伯恩斯情绪记录小程序启动')
    
    // 检查存储权限
    wx.getStorageInfo({
      success: (res) => {
        console.log('当前存储使用情况：', res.currentSize, 'KB /', res.limitSize, 'KB')
      }
    })
  },

  onShow() {
    console.log('小程序显示')
  },

  onHide() {
    console.log('小程序隐藏')
  },

  globalData: {
    version: '1.0.0'
  }
})