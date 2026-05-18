import { CHANGELOG_MARKDOWN } from '../../models/Constants.js'

Page({
  data: {
    version: '1.1.5',
    showChangelogModal: false
  },

  onGoBack() { wx.navigateBack() },
  
  onGoToTutorial() { 
    wx.vibrateShort({ type: 'light' })
    wx.navigateTo({ url: '/pages/tutorial/tutorial' }) 
  },


  onShowChangelog() { 
    wx.vibrateShort({ type: 'light' })
    this.setData({ showChangelogModal: true }) 
  },
  
  onCloseChangelog() { 
    wx.vibrateShort({ type: 'light' })
    this.setData({ showChangelogModal: false }) 
  }
})