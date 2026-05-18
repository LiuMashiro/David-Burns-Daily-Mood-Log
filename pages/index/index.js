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
    isBatchExport: false,
    showImportModal: false,
    importMarkdown: '',
    isBatchImport: false,
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
    expandedEmotions: [],
    expandedThoughts: [],
    emotionLibraryExpanded: true,
    
    // Slider 编辑弹窗状态
    showSliderInputModal: false,
    sliderInputValue: '',
    sliderInputContext: null
  },

  onLoad() { this.initRecord() },
  onShow() { this.refreshData() },
  noop() {},
  
  vibrate() { wx.vibrateShort({ type: 'light' }) },

  initRecord() {
    const record = RecordService.getCurrentRecord()
    this.setData({ 
      record, 
      emotionCategories: EMOTION_CATEGORIES, 
      cognitiveDistortions: COGNITIVE_DISTORTIONS,
      expandedEmotions: record.emotions.length > 0 ? [record.emotions[0].categoryId] : [],
      expandedThoughts: record.negativeThoughts.length > 0 ? [record.negativeThoughts[0].id] : []
    })
  },

  refreshData() {
    const record = RecordService.getCurrentRecord()
    
    record.formattedTime = this.formatTimestamp(record.timestamp || Date.now())
    
    record.negativeThoughts.forEach(thought => {
      if (thought.distortions.length > 0) {
        thought.distortionNamesStr = thought.distortions.map(id => {
          const d = COGNITIVE_DISTORTIONS.find(c => c.id === id); return d ? d.name : id
        }).join('、')
      } else { thought.distortionNamesStr = '点击识别' }
      thought.summaryText = thought.positiveThought || thought.content || '未填写'
    })
    
    const { expandedEmotions, expandedThoughts } = this.data
    const validExpandedEmotions = expandedEmotions.filter(id => record.emotions.some(e => e.categoryId === id))
    const validExpandedThoughts = expandedThoughts.filter(id => record.negativeThoughts.some(t => t.id === id))
    
    this.setData({ record, expandedEmotions: validExpandedEmotions, expandedThoughts: validExpandedThoughts })
  },

  onEventInput(e) { RecordService.currentRecord.eventDescription = e.detail.value; this.setData({ 'record.eventDescription': e.detail.value }) },
  onOpenEmotionPicker(e) {
    this.vibrate()
    const { categoryId, categoryName } = e.currentTarget.dataset
    const category = EMOTION_CATEGORIES.find(c => c.id === categoryId)
    const existing = RecordService.currentRecord.emotions.find(e => e.categoryId === categoryId)
    const expandedEmotions = [...this.data.expandedEmotions]
    if (!expandedEmotions.includes(categoryId)) { expandedEmotions.push(categoryId); this.setData({ expandedEmotions }) }
    this.setData({
      showEmotionPicker: true, currentPickerCategory: { categoryId, categoryName },
      pickerEmotions: category ? category.emotions : [],
      tempSelectedEmotions: existing ? [...existing.selectedEmotions] : [],
      tempCustomEmotions: existing ? [...existing.customEmotions] : []
    })
  },
  onToggleEmotionInPicker(e) {
    this.vibrate()
    const { emotion } = e.currentTarget.dataset
    let tempSelectedEmotions = [...this.data.tempSelectedEmotions]
    const idx = tempSelectedEmotions.indexOf(emotion)
    if (idx >= 0) tempSelectedEmotions.splice(idx, 1)
    else tempSelectedEmotions.push(emotion)
    this.setData({ tempSelectedEmotions })
  },
  onRemoveCustomEmotionInPicker(e) {
    this.vibrate()
    const { emotion } = e.currentTarget.dataset
    let tempCustomEmotions = [...this.data.tempCustomEmotions]
    tempCustomEmotions.splice(tempCustomEmotions.indexOf(emotion), 1)
    this.setData({ tempCustomEmotions })
  },
  onConfirmAddEmotion() {
    this.vibrate()
    const { currentPickerCategory, tempSelectedEmotions, tempCustomEmotions } = this.data
    if (tempSelectedEmotions.length === 0 && tempCustomEmotions.length === 0) {
      RecordService.currentRecord.removeEmotion(currentPickerCategory.categoryId)
      this.setData({ expandedEmotions: this.data.expandedEmotions.filter(id => id !== currentPickerCategory.categoryId) })
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
    this.setData({ showEmotionPicker: false, currentPickerCategory: null, tempSelectedEmotions: [], tempCustomEmotions: [], pickerEmotions: [] })
    this.refreshData()
  },
  onCancelAddEmotion() { this.vibrate(); this.setData({ showEmotionPicker: false }) },
  onRemoveEmotionCategory(e) {
    this.vibrate()
    const { categoryId } = e.currentTarget.dataset
    RecordService.currentRecord.removeEmotion(categoryId)
    this.setData({ expandedEmotions: this.data.expandedEmotions.filter(id => id !== categoryId) })
    this.refreshData()
  },

  // 抽象化滑动条滑动过程实时渲染
  onEmotionSliderChanging(e) {
    const { index, field } = e.currentTarget.dataset
    this.setData({ [`record.emotions[${index}].${field}`]: e.detail.value })
  },
  // 滑动放开时更新核心模型
  onEmotionSliderChange(e) {
    this.vibrate()
    const { index, field } = e.currentTarget.dataset
    RecordService.currentRecord.emotions[index][field] = e.detail.value
  },
  onThoughtSliderChanging(e) {
    const { index, field } = e.currentTarget.dataset
    this.setData({ [`record.negativeThoughts[${index}].${field}`]: e.detail.value })
  },
  onThoughtSliderChange(e) {
    this.vibrate()
    const { index, field } = e.currentTarget.dataset
    RecordService.currentRecord.negativeThoughts[index][field] = e.detail.value
  },

  // 呼出数值编辑弹窗
  onEditSlider(e) {
    this.vibrate()
    const { type, field, index, value } = e.currentTarget.dataset
    this.setData({
      showSliderInputModal: true,
      sliderInputValue: value,
      sliderInputContext: { type, field, index }
    })
  },
  onSliderInput(e) {
    this.setData({ sliderInputValue: e.detail.value })
  },
  onConfirmSliderInput() {
    this.vibrate()
    let val = parseInt(this.data.sliderInputValue)
    if (isNaN(val)) val = 0
    if (val < 0) val = 0
    if (val > 100) val = 100
    
    const { type, field, index } = this.data.sliderInputContext
    if (type === 'emotion') {
      RecordService.currentRecord.emotions[index][field] = val
      this.setData({ [`record.emotions[${index}].${field}`]: val })
    } else if (type === 'thought') {
      RecordService.currentRecord.negativeThoughts[index][field] = val
      this.setData({ [`record.negativeThoughts[${index}].${field}`]: val })
    }
    this.setData({ showSliderInputModal: false })
  },
  onCancelSliderInput() {
    this.vibrate()
    this.setData({ showSliderInputModal: false })
  },

  toggleEmotion(e) {
    this.vibrate()
    const { categoryId } = e.currentTarget.dataset
    const expandedEmotions = [...this.data.expandedEmotions]
    const idx = expandedEmotions.indexOf(categoryId)
    if (idx >= 0) expandedEmotions.splice(idx, 1)
    else expandedEmotions.push(categoryId)
    this.setData({ expandedEmotions })
  },
  toggleEmotionLibrary() { this.vibrate(); this.setData({ emotionLibraryExpanded: !this.data.emotionLibraryExpanded }) },
  onShowCustomEmotionInput() { this.vibrate(); this.setData({ showCustomEmotionInput: true, customEmotionName: '' }) },
  onCustomEmotionInput(e) { this.setData({ customEmotionName: e.detail.value }) },
  onConfirmCustomEmotion() {
    this.vibrate()
    const { tempCustomEmotions, customEmotionName } = this.data
    if (!customEmotionName || customEmotionName.trim() === '') { showToast('请输入情绪名称'); return }
    tempCustomEmotions.push(customEmotionName.trim())
    this.setData({ tempCustomEmotions, showCustomEmotionInput: false, customEmotionName: '' })
  },
  onCancelCustomEmotion() { this.vibrate(); this.setData({ showCustomEmotionInput: false, customEmotionName: '' }) },
  onAddNegativeThought() {
    this.vibrate()
    const thought = new NegativeThought()
    RecordService.currentRecord.addNegativeThought(thought)
    this.setData({ expandedThoughts: [thought.id] })
    this.refreshData()
  },
  onDeleteNegativeThought(e) {
    this.vibrate()
    showConfirm('确认删除', '确定要删除这条记录吗？').then(c => {
      if (c) {
        RecordService.currentRecord.removeNegativeThought(e.currentTarget.dataset.thoughtId)
        this.setData({ expandedThoughts: this.data.expandedThoughts.filter(id => id !== e.currentTarget.dataset.thoughtId) })
        this.refreshData()
      }
    })
  },
  onThoughtContentInput(e) {
    RecordService.currentRecord.negativeThoughts[e.currentTarget.dataset.index].content = e.detail.value
    this.setData({ [`record.negativeThoughts[${e.currentTarget.dataset.index}].content`]: e.detail.value })
    this.refreshData()
  },
  onShowDistortionPicker(e) {
    this.vibrate()
    const { index } = e.currentTarget.dataset
    const thought = RecordService.currentRecord.negativeThoughts[index]
    const expandedThoughts = [...this.data.expandedThoughts]
    if (!expandedThoughts.includes(thought.id)) { expandedThoughts.push(thought.id); this.setData({ expandedThoughts }) }
    this.setData({ showDistortionPicker: true, currentThoughtIndex: index, tempSelectedDistortions: [...thought.distortions] })
  },
  onToggleDistortion(e) {
    this.vibrate()
    let temp = [...this.data.tempSelectedDistortions]
    const idx = temp.indexOf(e.currentTarget.dataset.distortionId)
    if (idx >= 0) temp.splice(idx, 1)
    else temp.push(e.currentTarget.dataset.distortionId)
    this.setData({ tempSelectedDistortions: temp })
  },
  onConfirmDistortions() {
    this.vibrate()
    RecordService.currentRecord.negativeThoughts[this.data.currentThoughtIndex].distortions = [...this.data.tempSelectedDistortions]
    this.setData({ showDistortionPicker: false, currentThoughtIndex: -1, tempSelectedDistortions: [] })
    this.refreshData()
  },
  onCancelDistortions() { this.vibrate(); this.setData({ showDistortionPicker: false, currentThoughtIndex: -1 }) },
  onAddIfThenQuestion(e) { this.vibrate(); RecordService.currentRecord.negativeThoughts[e.currentTarget.dataset.index].addIfThenQuestion(); this.refreshData() },
  onDeleteIfThenQuestion(e) { this.vibrate(); RecordService.currentRecord.negativeThoughts[e.currentTarget.dataset.thoughtIndex].removeIfThenQuestion(e.currentTarget.dataset.questionId); this.refreshData() },
  onIfThenAnswerInput(e) {
    const { thoughtIndex, questionIndex } = e.currentTarget.dataset
    RecordService.currentRecord.negativeThoughts[thoughtIndex].ifThenQuestions[questionIndex].answer = e.detail.value
    this.setData({ [`record.negativeThoughts[${thoughtIndex}].ifThenQuestions[${questionIndex}].answer`]: e.detail.value })
  },
  onPositiveThoughtInput(e) {
    RecordService.currentRecord.negativeThoughts[e.currentTarget.dataset.index].positiveThought = e.detail.value
    this.setData({ [`record.negativeThoughts[${e.currentTarget.dataset.index}].positiveThought`]: e.detail.value })
    this.refreshData()
  },
  toggleThought(e) {
    this.vibrate()
    const expandedThoughts = [...this.data.expandedThoughts]
    const idx = expandedThoughts.indexOf(e.currentTarget.dataset.thoughtId)
    if (idx >= 0) expandedThoughts.splice(idx, 1)
    else expandedThoughts.push(e.currentTarget.dataset.thoughtId)
    this.setData({ expandedThoughts })
  },
  onShowDistortionGuide() { this.vibrate(); this.setData({ showDistortionGuideModal: true }) },
  onCloseDistortionGuide() { this.vibrate(); this.setData({ showDistortionGuideModal: false }) },
  
  onShowEncouragement() {
    this.vibrate()
    const randomEncouragement = ENCOURAGEMENTS[Math.floor(Math.random() * ENCOURAGEMENTS.length)]
    this.setData({ showEncouragementModal: true, currentEncouragement: randomEncouragement, encouragementText: '' })
    this.typewriterEffect(randomEncouragement)
  },
  typewriterEffect(text, index = 0) {
    if (!this.data.showEncouragementModal) return
    if (index < text.length) {
      this.setData({ encouragementText: text.substring(0, index + 1) })
      // 打字机速度调整：从 80ms 改为 30ms 显著加快
      setTimeout(() => { this.typewriterEffect(text, index + 1) }, 30)
    }
  },
  onCloseEncouragement() { this.vibrate(); this.setData({ showEncouragementModal: false }) },

  async onShowHistory() {
    this.vibrate()
    wx.showLoading({ title: '加载中...' })
    try {
      const records = await RecordService.loadHistory()
      
      // 遍历补充时间字符串，用于列表直接渲染
      records.forEach(r => r.formattedTime = this.formatTimestamp(r.timestamp))
      
      this.setData({ showHistoryModal: true, historyRecords: records })
    } catch (error) { showToast('加载失败') } finally { wx.hideLoading() }
  },
  onCloseHistory() { this.vibrate(); this.setData({ showHistoryModal: false }) },
  onViewHistoryDetail(e) { this.vibrate(); this.setData({ showHistoryDetailModal: true, currentHistoryRecord: e.currentTarget.dataset.record }) },
  onCloseHistoryDetail() { this.vibrate(); this.setData({ showHistoryDetailModal: false, currentHistoryRecord: null }) },
  
  onLoadHistoryToEdit() {
    this.vibrate()
    RecordService.loadRecord(this.data.currentHistoryRecord)
    const record = RecordService.getCurrentRecord()
    this.setData({ expandedEmotions: record.emotions.length > 0 ? [record.emotions[0].categoryId] : [], expandedThoughts: record.negativeThoughts.length > 0 ? [record.negativeThoughts[0].id] : [], showHistoryModal: false, showHistoryDetailModal: false, currentHistoryRecord: null })
    this.refreshData(); showToast('记录已加载'); wx.pageScrollTo({ scrollTop: 0, duration: 300 })
  },
  
  async onDeleteHistoryRecord() {
    this.vibrate()
    const confirmed = await showConfirm('确认删除', '删除后无法恢复，确定要删除这条记录吗？')
    if (!confirmed) return
    wx.showLoading({ title: '删除中...' })
    try {
      await RecordService.deleteHistory(this.data.currentHistoryRecord.id)
      const records = await RecordService.loadHistory()
      
      records.forEach(r => r.formattedTime = this.formatTimestamp(r.timestamp))
      
      this.setData({ historyRecords: records, showHistoryDetailModal: false, currentHistoryRecord: null })
      showToast('删除成功')
    } catch (error) { showToast('删除失败') } finally { wx.hideLoading() }
  },

  onShowExport() {
    this.vibrate()
    const validation = RecordService.validate()
    if (!validation.isValid) { showToast(validation.errors[0]); return; }
    this.setData({ showExportModal: true, isBatchExport: false, exportMarkdown: RecordService.exportMarkdown(), exportViewMode: 'preview', saveToHistory: true })
  },
  
  async onShowBatchExport() {
    this.vibrate()
    wx.showLoading({ title: '生成中...' })
    try {
      const records = await RecordService.loadHistory()
      if (records.length === 0) { wx.hideLoading(); showToast('历史记录为空'); return }
      
      const markdown = RecordService.exportAllHistory(records)
      
      this.setData({ 
        showHistoryModal: false, 
        showExportModal: true, 
        isBatchExport: true, 
        exportMarkdown: markdown, 
        exportViewMode: 'code', 
        saveToHistory: false 
      })
    } catch (error) {
      console.error('批量导出失败:', error)
      showToast('导出失败，请重试')
    } finally {
      wx.hideLoading()
    }
  },

  onSwitchExportView(e) { this.vibrate(); this.setData({ exportViewMode: e.currentTarget.dataset.mode }) },
  onToggleSaveToHistory() { this.vibrate(); this.setData({ saveToHistory: !this.data.saveToHistory }) },
  
  async onCopyMarkdown() {
    this.vibrate()
    try {
      await copyToClipboard(this.data.exportMarkdown)
      if (this.data.saveToHistory && !this.data.isBatchExport) { await RecordService.saveToHistory(); showToast('已复制并保存'); }
    } catch (error) { showToast('复制失败') }
  },
  onCloseExport() { this.vibrate(); this.setData({ showExportModal: false }) },
  
  onShowImport() { this.vibrate(); this.setData({ showImportModal: true, importMarkdown: '', isBatchImport: false }) },
  
  onShowBatchImport() { 
    this.vibrate(); 
    this.setData({ 
      showHistoryModal: false, 
      showImportModal: true, 
      importMarkdown: '', 
      isBatchImport: true 
    }) 
  },
  
  onImportInput(e) { this.setData({ importMarkdown: e.detail.value }) },
  
  async onConfirmImport() {
    this.vibrate()
    if (!this.data.importMarkdown) { showToast('请粘贴内容'); return; }
    
    if (this.data.isBatchImport) {
      const confirmed = await showConfirm('确认批量导入', '导入将合并至历史记录，可能覆盖同ID数据，确定继续吗？')
      if (!confirmed) return
      wx.showLoading({ title: '合并中...' })
      try {
        const count = await RecordService.importAllToHistory(this.data.importMarkdown)
        const records = await RecordService.loadHistory()
        records.forEach(r => r.formattedTime = this.formatTimestamp(r.timestamp))
        this.setData({ showImportModal: false, importMarkdown: '', historyRecords: records })
        showToast(`成功导入 ${count} 条记录`)
      } catch (error) { showToast(error.message) } finally { wx.hideLoading() }
    } else {
      const confirmed = await showConfirm('确认导入', '将覆盖当前未保存的编辑内容，继续吗？')
      if (!confirmed) return
      try {
        RecordService.importMarkdown(this.data.importMarkdown)
        const record = RecordService.getCurrentRecord()
        this.setData({ expandedEmotions: record.emotions.length > 0 ? [record.emotions[0].categoryId] : [], expandedThoughts: record.negativeThoughts.length > 0 ? [record.negativeThoughts[0].id] : [] })
        this.refreshData()
        this.setData({ showImportModal: false, importMarkdown: '' })
        showToast('导入成功'); wx.pageScrollTo({ scrollTop: 0 })
      } catch (error) { showToast(error.message) }
    }
  },
  onCancelImport() { this.vibrate(); this.setData({ showImportModal: false, importMarkdown: '' }) },
  
  async onReset() {
    this.vibrate()
    const confirmed = await showConfirm('确认重置', '将清空当前内容，继续吗？')
    if (!confirmed) return
    RecordService.reset()
    this.setData({ expandedEmotions: [], expandedThoughts: [] })
    this.refreshData(); showToast('已重置'); wx.pageScrollTo({ scrollTop: 0 })
  },
  
  onGoToAbout() { this.vibrate(); wx.navigateTo({ url: '/pages/about/about' }) },
  onGoToTutorial() { this.vibrate(); wx.navigateTo({ url: '/pages/tutorial/tutorial' }) },
  
  formatTimestamp(timestamp) { return formatDate(timestamp, 'YYYY-MM-DD HH:mm') }
})