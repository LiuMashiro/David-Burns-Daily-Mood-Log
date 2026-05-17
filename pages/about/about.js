/**
 * 关于页面逻辑
 * 提供应用说明、使用指南、隐私声明等信息
 */

Page({
  data: {
    version: '1.0.0',
    sections: [
      {
        id: 'intro',
        title: '应用简介',
        icon: '📱',
        expanded: true
      },
      {
        id: 'guide',
        title: '使用说明',
        icon: '📖',
        expanded: false
      },
      {
        id: 'distortions',
        title: '认知扭曲优化说明',
        icon: '🧠',
        expanded: false
      },
      {
        id: 'privacy',
        title: '隐私安全',
        icon: '🔒',
        expanded: false
      }
    ]
  },

  /**
   * 切换章节展开/收起
   */
  onToggleSection(e) {
    const { sectionId } = e.currentTarget.dataset
    const { sections } = this.data
    
    const updatedSections = sections.map(section => {
      if (section.id === sectionId) {
        return { ...section, expanded: !section.expanded }
      }
      return section
    })

    this.setData({ sections: updatedSections })
  },

  /**
   * 返回上一页
   */
  onGoBack() {
    wx.navigateBack()
  },

  /**
   * 复制联系方式（示例）
   */
  onCopyContact() {
    wx.setClipboardData({
      data: 'burns-emotion@example.com',
      success: () => {
        wx.showToast({
          title: '已复制联系方式',
          icon: 'success'
        })
      }
    })
  }
})