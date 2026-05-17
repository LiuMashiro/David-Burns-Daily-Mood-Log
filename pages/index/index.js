/**
 * 主页面逻辑
 */
import { EMOTION_CATEGORIES, COGNITIVE_DISTORTIONS, ENCOURAGEMENTS } from '../../models/Constants.js'
import { SelectedEmotion } from '../../models/EmotionRecord.js'
import { NegativeThought } from '../../models/NegativeThought.js'
import RecordService from '../../services/RecordService.js'
import { formatDate, copyToClipboard, showConfirm, showToast, debounce } from '../../utils/util.js'

Page({
  data: {
    record: null,
    emotionCategories: EMOTION_CATEGORIES,
    cognitiveDistortions: COGNITIVE_DISTORTIONS,
    
    showEncouragementModal: false,
    currentEncouragement: '',
    encouragementText: '',
    
    showHistoryModal: false,
    historyRecords: [],
    showHistoryDetailModal: false,
    currentHistoryRecord: null,
    
    showExportModal: false,
    exportMarkdown: '',
    exportViewMode: 'preview',
    saveToHistory: true,
    
    showImportModal: false,
    importMarkdown: '',
    
    showEmotionPicker: false,
    currentPickerCategory: null,
    pickerEmotions: [],
    tempSelectedEmotions: [],
    tempCustomEmotions: [], 
    
    showDistortionPicker: false,
    currentThoughtIndex: -1,
    tempSelectedDistortions: [],

    showDistortionGuideModal: false, 
    
    showCustomEmotionInput: false,
    customEmotionName: '',

    // 折叠功能相关数据
    expandedEmotions: [], // 存储展开的情绪categoryId
    expandedThoughts: [], // 存储展开的想法id
    emotionLibraryExpanded: true // 情绪分类库是否展开
  },

  onLoad() { this.initRecord() },
  onShow() { this.refreshData() },
  noop() {},

  initRecord() {
    const record = RecordService.getCurrentRecord()
    this.setData({ 
      record, 
      emotionCategories: EMOTION_CATEGORIES, 
      cognitiveDistortions: COGNITIVE_DISTORTIONS,
      // 初始化展开状态：默认展开第一个情绪和第一个想法
      expandedEmotions: record.emotions.length > 0 ? [record.emotions[0].categoryId] : [],
      expandedThoughts: record.negativeThoughts.length > 0 ? [record.negativeThoughts[0].id] : []
    })
  },

  refreshData() {
    const record = RecordService.getCurrentRecord()
    record.negativeThoughts.forEach(thought => {
      if (thought.distortions.length > 0) {
        thought.distortionNamesStr = thought.distortions.map(id => {
          const distortion = COGNITIVE_DISTORTIONS.find(d => d.id === id)
          return distortion ? distortion.name : id
        }).join('、')
      } else {
        thought.distortionNamesStr = '点击识别'
      }
      
      // 为折叠显示准备摘要文本
      thought.summaryText = thought.positiveThought || thought.content || '未填写'
    })
    
    // 确保展开状态数组与当前记录同步
    const { expandedEmotions, expandedThoughts } = this.data
    const validExpandedEmotions = expandedEmotions.filter(id => 
      record.emotions.some(e => e.categoryId === id)
    )
    const validExpandedThoughts = expandedThoughts.filter(id => 
      record.negativeThoughts.some(t => t.id === id)
    )
    
    this.setData({ 
      record: record,
      expandedEmotions: validExpandedEmotions,
      expandedThoughts: validExpandedThoughts
    })
  },

  onEventInput(e) {
    RecordService.currentRecord.eventDescription = e.detail.value
    this.setData({ 'record.eventDescription': e.detail.value })
  },

  // ===== 情绪管理 =====
  onOpenEmotionPicker(e) {
    const { categoryId, categoryName } = e.currentTarget.dataset
    const category = EMOTION_CATEGORIES.find(c => c.id === categoryId)
    const pickerEmotions = category ? category.emotions : []
    
    // 查找是否已有选择记录
    const existing = RecordService.currentRecord.emotions.find(e => e.categoryId === categoryId)
    
    // 确保打开的情绪是展开的
    const expandedEmotions = [...this.data.expandedEmotions]
    if (!expandedEmotions.includes(categoryId)) {
      expandedEmotions.push(categoryId)
      this.setData({ expandedEmotions })
    }
    
    this.setData({
      showEmotionPicker: true,
      currentPickerCategory: { categoryId, categoryName },
      pickerEmotions: pickerEmotions,
      tempSelectedEmotions: existing ? [...existing.selectedEmotions] : [],
      tempCustomEmotions: existing ? [...existing.customEmotions] : []
    })
  },

  onToggleEmotionInPicker(e) {
    const { emotion } = e.currentTarget.dataset
    let tempSelectedEmotions = [...this.data.tempSelectedEmotions]
    const index = tempSelectedEmotions.indexOf(emotion)
    if (index >= 0) tempSelectedEmotions.splice(index, 1)
    else tempSelectedEmotions.push(emotion)
    this.setData({ tempSelectedEmotions })
  },

  onRemoveCustomEmotionInPicker(e) {
    const { emotion } = e.currentTarget.dataset
    let tempCustomEmotions = [...this.data.tempCustomEmotions]
    const index = tempCustomEmotions.indexOf(emotion)
    if (index >= 0) tempCustomEmotions.splice(index, 1)
    this.setData({ tempCustomEmotions })
  },

  onConfirmAddEmotion() {
    const { currentPickerCategory, tempSelectedEmotions, tempCustomEmotions } = this.data
    
    if (tempSelectedEmotions.length === 0 && tempCustomEmotions.length === 0) {
      // 如果全清空了，则移除该类别
      RecordService.currentRecord.removeEmotion(currentPickerCategory.categoryId)
      // 同时从展开列表中移除
      const expandedEmotions = this.data.expandedEmotions.filter(id => id !== currentPickerCategory.categoryId)
      this.setData({ expandedEmotions })
    } else {
      let emotion = RecordService.currentRecord.emotions.find(e => e.categoryId === currentPickerCategory.categoryId)
      if (!emotion) {
        emotion = new SelectedEmotion(currentPickerCategory.categoryId, currentPickerCategory.categoryName)
        RecordService.currentRecord.addEmotion(emotion)
        this.setData({ expandedEmotions: [currentPickerCategory.categoryId] })
      }
      emotion.selectedEmotions = [...tempSelectedEmotions]
      emotion.customEmotions = [...tempCustomEmotions]
    }
    
    this.setData({
      showEmotionPicker: false,
      currentPickerCategory: null,
      tempSelectedEmotions: [],
      tempCustomEmotions: [],
      pickerEmotions: []
    })
    this.refreshData()
    wx.vibrateShort()
  },

  onCancelAddEmotion() {
    this.setData({ showEmotionPicker: false, currentPickerCategory: null, tempSelectedEmotions: [], tempCustomEmotions: [], pickerEmotions: [] })
  },

  onRemoveEmotionCategory(e) {
    const { categoryId } = e.currentTarget.dataset
    RecordService.currentRecord.removeEmotion(categoryId)
    // 同时从展开列表中移除
    const expandedEmotions = this.data.expandedEmotions.filter(id => id !== categoryId)
    this.setData({ expandedEmotions })
    this.refreshData()
    wx.vibrateShort()
  },

  onBeforeIntensityChange: debounce(function(e) {
    const { index } = e.currentTarget.dataset
    RecordService.currentRecord.emotions[index].beforeIntensity = e.detail.value
    this.setData({ [`record.emotions[${index}].beforeIntensity`]: e.detail.value })
  }, 100),

  onAfterIntensityChange: debounce(function(e) {
    const { index } = e.currentTarget.dataset
    RecordService.currentRecord.emotions[index].afterIntensity = e.detail.value
    this.setData({ [`record.emotions[${index}].afterIntensity`]: e.detail.value })
  }, 100),

  // ===== 情绪折叠功能 =====
  toggleEmotion(e) {
    const { categoryId } = e.currentTarget.dataset
    const expandedEmotions = [...this.data.expandedEmotions]
    const index = expandedEmotions.indexOf(categoryId)
    
    if (index >= 0) {
      expandedEmotions.splice(index, 1)
    } else {
      expandedEmotions.push(categoryId)
    }
    
    this.setData({ expandedEmotions })
  },

  // ===== 情绪分类库折叠功能 =====
  toggleEmotionLibrary() {
    this.setData({ emotionLibraryExpanded: !this.data.emotionLibraryExpanded })
  },

  // ===== 自定义情绪面板流 =====
  onShowCustomEmotionInput() {
    this.setData({ showCustomEmotionInput: true, customEmotionName: '' })
  },

  onCustomEmotionInput(e) {
    this.setData({ customEmotionName: e.detail.value })
  },

  onConfirmCustomEmotion() {
    const { tempCustomEmotions, customEmotionName } = this.data
    if (!customEmotionName || customEmotionName.trim() === '') {
      showToast('请输入情绪名称')
      return
    }
    tempCustomEmotions.push(customEmotionName.trim())
    this.setData({
      tempCustomEmotions: tempCustomEmotions,
      showCustomEmotionInput: false,
      customEmotionName: ''
    })
  },

  onCancelCustomEmotion() {
    this.setData({ showCustomEmotionInput: false, customEmotionName: '' })
  },

  // ===== 消极想法管理 =====
  onAddNegativeThought() {
    const thought = new NegativeThought()
    RecordService.currentRecord.addNegativeThought(thought)
    // 新添加的想法：折叠所有旧想法，只展开新的
    this.setData({ expandedThoughts: [thought.id] })
    this.refreshData()
    wx.vibrateShort()
  },

  onDeleteNegativeThought(e) {
    const { thoughtId } = e.currentTarget.dataset
    showConfirm('确认删除', '确定要删除这条记录吗？').then(confirmed => {
      if (confirmed) {
        RecordService.currentRecord.removeNegativeThought(thoughtId)
        // 同时从展开列表中移除
        const expandedThoughts = this.data.expandedThoughts.filter(id => id !== thoughtId)
        this.setData({ expandedThoughts })
        this.refreshData()
        wx.vibrateShort()
      }
    })
  },

  onThoughtContentInput(e) {
    const { index } = e.currentTarget.dataset
    RecordService.currentRecord.negativeThoughts[index].content = e.detail.value
    this.setData({ [`record.negativeThoughts[${index}].content`]: e.detail.value })
    // 更新摘要文本
    this.refreshData()
  },

  onBeforeBeliefChange: debounce(function(e) {
    const { index } = e.currentTarget.dataset
    RecordService.currentRecord.negativeThoughts[index].beforeBelief = e.detail.value
    this.setData({ [`record.negativeThoughts[${index}].beforeBelief`]: e.detail.value })
  }, 100),

  onAfterBeliefChange: debounce(function(e) {
    const { index } = e.currentTarget.dataset
    RecordService.currentRecord.negativeThoughts[index].afterBelief = e.detail.value
    this.setData({ [`record.negativeThoughts[${index}].afterBelief`]: e.detail.value })
  }, 100),

  onShowDistortionPicker(e) {
    const { index } = e.currentTarget.dataset
    const thought = RecordService.currentRecord.negativeThoughts[index]
    // 确保打开的想法是展开的
    const expandedThoughts = [...this.data.expandedThoughts]
    if (!expandedThoughts.includes(thought.id)) {
      expandedThoughts.push(thought.id)
      this.setData({ expandedThoughts })
    }
    this.setData({
      showDistortionPicker: true,
      currentThoughtIndex: index,
      tempSelectedDistortions: [...thought.distortions]
    })
  },

  onToggleDistortion(e) {
    const { distortionId } = e.currentTarget.dataset
    let tempSelectedDistortions = [...this.data.tempSelectedDistortions]
    const index = tempSelectedDistortions.indexOf(distortionId)
    if (index >= 0) tempSelectedDistortions.splice(index, 1)
    else tempSelectedDistortions.push(distortionId)
    this.setData({ tempSelectedDistortions })
  },

  onConfirmDistortions() {
    const { currentThoughtIndex, tempSelectedDistortions } = this.data
    RecordService.currentRecord.negativeThoughts[currentThoughtIndex].distortions = [...tempSelectedDistortions]
    this.setData({ showDistortionPicker: false, currentThoughtIndex: -1, tempSelectedDistortions: [] })
    this.refreshData()
  },

  onCancelDistortions() {
    this.setData({ showDistortionPicker: false, currentThoughtIndex: -1, tempSelectedDistortions: [] })
  },

  onAddIfThenQuestion(e) {
    const { index } = e.currentTarget.dataset
    RecordService.currentRecord.negativeThoughts[index].addIfThenQuestion()
    this.refreshData()
  },

  onDeleteIfThenQuestion(e) {
    const { thoughtIndex, questionId } = e.currentTarget.dataset
    RecordService.currentRecord.negativeThoughts[thoughtIndex].removeIfThenQuestion(questionId)
    this.refreshData()
  },

  onIfThenAnswerInput(e) {
    const { thoughtIndex, questionIndex } = e.currentTarget.dataset
    RecordService.currentRecord.negativeThoughts[thoughtIndex].ifThenQuestions[questionIndex].answer = e.detail.value
    this.setData({ [`record.negativeThoughts[${thoughtIndex}].ifThenQuestions[${questionIndex}].answer`]: e.detail.value })
  },

  onPositiveThoughtInput(e) {
    const { index } = e.currentTarget.dataset
    RecordService.currentRecord.negativeThoughts[index].positiveThought = e.detail.value
    this.setData({ [`record.negativeThoughts[${index}].positiveThought`]: e.detail.value })
    // 更新摘要文本
    this.refreshData()
  },

  onPositiveBeliefChange: debounce(function(e) {
    const { index } = e.currentTarget.dataset
    RecordService.currentRecord.negativeThoughts[index].positiveBeliefBefore = e.detail.value
    this.setData({ [`record.negativeThoughts[${index}].positiveBeliefBefore`]: e.detail.value })
  }, 100),

  // ===== 想法折叠功能 =====
  toggleThought(e) {
    const { thoughtId } = e.currentTarget.dataset
    const expandedThoughts = [...this.data.expandedThoughts]
    const index = expandedThoughts.indexOf(thoughtId)
    
    if (index >= 0) {
      expandedThoughts.splice(index, 1)
    } else {
      expandedThoughts.push(thoughtId)
    }
    
    this.setData({ expandedThoughts })
  },

  // ===== 认知扭曲参考指南弹窗 =====
  onShowDistortionGuide() { this.setData({ showDistortionGuideModal: true }) },
  onCloseDistortionGuide() { this.setData({ showDistortionGuideModal: false }) },

  // ===== 杂项辅助方法 =====
  onShowEncouragement() {
    const randomEncouragement = ENCOURAGEMENTS[Math.floor(Math.random() * ENCOURAGEMENTS.length)]
    this.setData({ showEncouragementModal: true, currentEncouragement: randomEncouragement, encouragementText: '' })
    this.typewriterEffect(randomEncouragement)
  },
  typewriterEffect(text, index = 0) {
    if (!this.data.showEncouragementModal) return
    if (index < text.length) {
      this.setData({ encouragementText: text.substring(0, index + 1) })
      setTimeout(() => { this.typewriterEffect(text, index + 1) }, 80)
    }
  },
  onCloseEncouragement() { this.setData({ showEncouragementModal: false }) },

  async onShowHistory() {
    wx.showLoading({ title: '加载中...' })
    try {
      const records = await RecordService.loadHistory()
      this.setData({ showHistoryModal: true, historyRecords: records })
    } catch (error) { showToast('加载失败') } finally { wx.hideLoading() }
  },
  onCloseHistory() { this.setData({ showHistoryModal: false }) },
  onViewHistoryDetail(e) { this.setData({ showHistoryDetailModal: true, currentHistoryRecord: e.currentTarget.dataset.record }) },
  onCloseHistoryDetail() { this.setData({ showHistoryDetailModal: false, currentHistoryRecord: null }) },
  onLoadHistoryToEdit() {
    RecordService.loadRecord(this.data.currentHistoryRecord)
    // 加载历史记录时，默认展开第一个情绪和第一个想法
    const record = RecordService.getCurrentRecord()
    this.setData({
      expandedEmotions: record.emotions.length > 0 ? [record.emotions[0].categoryId] : [],
      expandedThoughts: record.negativeThoughts.length > 0 ? [record.negativeThoughts[0].id] : []
    })
    this.refreshData()
    this.setData({ showHistoryModal: false, showHistoryDetailModal: false, currentHistoryRecord: null })
    showToast('记录已加载')
    wx.pageScrollTo({ scrollTop: 0, duration: 300 })
  },
  async onDeleteHistoryRecord() {
    const confirmed = await showConfirm('确认删除', '删除后无法恢复，确定要删除这条记录吗？')
    if (!confirmed) return
    wx.showLoading({ title: '删除中...' })
    try {
      await RecordService.deleteHistory(this.data.currentHistoryRecord.id)
      const records = await RecordService.loadHistory()
      this.setData({ historyRecords: records, showHistoryDetailModal: false, currentHistoryRecord: null })
      showToast('删除成功')
    } catch (error) { showToast('删除失败') } finally { wx.hideLoading() }
  },
  onShowExport() {
    const validation = RecordService.validate()
    if (!validation.isValid) { showToast(validation.errors[0]); return; }
    this.setData({ showExportModal: true, exportMarkdown: RecordService.exportMarkdown(), exportViewMode: 'preview', saveToHistory: true })
  },
  onSwitchExportView(e) { this.setData({ exportViewMode: e.currentTarget.dataset.mode }) },
  onToggleSaveToHistory() { this.setData({ saveToHistory: !this.data.saveToHistory }) },
  async onCopyMarkdown() {
    try {
      await copyToClipboard(this.data.exportMarkdown)
      if (this.data.saveToHistory) { await RecordService.saveToHistory(); showToast('已复制并保存'); }
    } catch (error) { showToast('复制失败') }
  },
  onCloseExport() { this.setData({ showExportModal: false }) },
  onShowImport() { this.setData({ showImportModal: true, importMarkdown: '' }) },
  onImportInput(e) { this.setData({ importMarkdown: e.detail.value }) },
  async onConfirmImport() {
    if (!this.data.importMarkdown) { showToast('请粘贴内容'); return; }
    const confirmed = await showConfirm('确认导入', '将覆盖当前内容，继续吗？')
    if (!confirmed) return
    try {
      RecordService.importMarkdown(this.data.importMarkdown)
      // 导入记录时，默认展开第一个情绪和第一个想法
      const record = RecordService.getCurrentRecord()
      this.setData({
        expandedEmotions: record.emotions.length > 0 ? [record.emotions[0].categoryId] : [],
        expandedThoughts: record.negativeThoughts.length > 0 ? [record.negativeThoughts[0].id] : []
      })
      this.refreshData()
      this.setData({ showImportModal: false, importMarkdown: '' })
      showToast('导入成功')
      wx.pageScrollTo({ scrollTop: 0 })
    } catch (error) { showToast('导入失败：格式错误') }
  },
  onCancelImport() { this.setData({ showImportModal: false, importMarkdown: '' }) },
  async onReset() {
    const confirmed = await showConfirm('确认重置', '将清空当前内容，继续吗？')
    if (!confirmed) return
    RecordService.reset()
    this.setData({ expandedEmotions: [], expandedThoughts: [] })
    this.refreshData()
    showToast('已重置')
    wx.pageScrollTo({ scrollTop: 0 })
  },
  onGoToAbout() { wx.navigateTo({ url: '/pages/about/about' }) },
  formatTimestamp(timestamp) { return formatDate(timestamp, 'YYYY-MM-DD HH:mm') },
  getChangeColorClass(change) { return change > 0 ? 'change-negative' : (change < 0 ? 'change-positive' : '') }
})