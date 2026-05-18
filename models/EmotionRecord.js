/**
 * 情绪记录领域模型
 * 封装情绪记录的所有数据和行为
 */

export class SelectedEmotion {
  constructor(categoryId, categoryName) {
    this.categoryId = categoryId
    this.categoryName = categoryName
    this.selectedEmotions = [] // 已选择的具体情绪列表
    this.customEmotions = [] // 用户自定义的情绪
    this.beforeIntensity = 100 // 默认初始强度为100
    this.afterIntensity = 0 // 默认之后强度为0
  }

  // 计算强度变化值（之前 - 之后，负值表示改善）
  getIntensityChange() {
    return this.beforeIntensity - this.afterIntensity
  }

  // 获取所有情绪（预设+自定义）
  getAllEmotions() {
    return [...this.selectedEmotions, ...this.customEmotions]
  }

  // 添加自定义情绪
  addCustomEmotion(emotion) {
    if (!this.customEmotions.includes(emotion)) {
      this.customEmotions.push(emotion)
    }
  }

  // 检查是否选择了至少一个情绪
  hasSelectedEmotions() {
    return this.selectedEmotions.length > 0 || this.customEmotions.length > 0
  }

  // 序列化为纯对象
  toJSON() {
    return {
      categoryId: this.categoryId,
      categoryName: this.categoryName,
      selectedEmotions: this.selectedEmotions,
      customEmotions: this.customEmotions,
      beforeIntensity: this.beforeIntensity,
      afterIntensity: this.afterIntensity
    }
  }

  // 从纯对象恢复
  static fromJSON(json) {
    const emotion = new SelectedEmotion(json.categoryId, json.categoryName)
    emotion.selectedEmotions = json.selectedEmotions || []
    emotion.customEmotions = json.customEmotions || []
    emotion.beforeIntensity = json.beforeIntensity !== undefined ? json.beforeIntensity : 100
    emotion.afterIntensity = json.afterIntensity !== undefined ? json.afterIntensity : 0
    return emotion
  }
}

export class EmotionRecord {
  constructor(data = {}) {
    this.id = data.id || this.generateId()
    this.timestamp = data.timestamp || Date.now()
    this.eventDescription = data.eventDescription || ''
    this.emotions = data.emotions || []
    this.negativeThoughts = data.negativeThoughts || []
  }

  // 生成唯一ID
  generateId() {
    return `record_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  // 添加情绪
  addEmotion(emotion) {
    // 检查是否已存在该类别
    const existingIndex = this.emotions.findIndex(e => e.categoryId === emotion.categoryId)
    if (existingIndex === -1) {
      this.emotions.push(emotion)
    }
  }

  // 移除情绪
  removeEmotion(categoryId) {
    this.emotions = this.emotions.filter(e => e.categoryId !== categoryId)
  }

  // 获取情绪通过ID
  getEmotionById(categoryId) {
    return this.emotions.find(e => e.categoryId === categoryId)
  }

  // 添加消极想法
  addNegativeThought(thought) {
    this.negativeThoughts.push(thought)
  }

  // 移除消极想法
  removeNegativeThought(thoughtId) {
    this.negativeThoughts = this.negativeThoughts.filter(t => t.id !== thoughtId)
  }

  // 获取想法通过ID
  getThoughtById(thoughtId) {
    return this.negativeThoughts.find(t => t.id === thoughtId)
  }

  // 验证记录是否完整（导出前检查）
  validate() {
    const errors = []
    
    if (!this.eventDescription || this.eventDescription.trim() === '') {
      errors.push('事件描述不能为空')
    }

    if (this.emotions.length === 0) {
      errors.push('请至少选择一个情绪类别')
    }

    this.emotions.forEach((emotion, index) => {
      if (!emotion.hasSelectedEmotions()) {
        errors.push(`情绪类别"${emotion.categoryName}"未选择具体情绪`)
      }
    })

    if (this.negativeThoughts.length === 0) {
      errors.push('请至少添加一条消极想法')
    }

    this.negativeThoughts.forEach((thought, index) => {
      if (!thought.content || thought.content.trim() === '') {
        errors.push(`第${index + 1}条消极想法内容为空`)
      }
    })

    return {
      isValid: errors.length === 0,
      errors: errors
    }
  }

  // 序列化为纯对象（用于存储）
  toJSON() {
    return {
      id: this.id,
      timestamp: this.timestamp,
      eventDescription: this.eventDescription,
      emotions: this.emotions.map(e => e.toJSON ? e.toJSON() : e),
      negativeThoughts: this.negativeThoughts.map(t => t.toJSON ? t.toJSON() : t)
    }
  }

  // 从纯对象恢复（从存储加载）
  static fromJSON(json) {
    const record = new EmotionRecord({
      id: json.id,
      timestamp: json.timestamp,
      eventDescription: json.eventDescription
    })

    // 恢复情绪
    if (json.emotions) {
      record.emotions = json.emotions.map(e => 
        e.categoryId ? SelectedEmotion.fromJSON(e) : e
      )
    }

    // 恢复想法
    if (json.negativeThoughts) {
      const { NegativeThought } = require('./NegativeThought.js')
      record.negativeThoughts = json.negativeThoughts.map(t =>
        t.id ? NegativeThought.fromJSON(t) : t
      )
    }

    return record
  }

  // 获取记录摘要（用于历史列表展示）
  getSummary() {
    return {
      id: this.id,
      timestamp: this.timestamp,
      eventSummary: this.eventDescription.substring(0, 50) + (this.eventDescription.length > 50 ? '...' : ''),
      emotionCount: this.emotions.length,
      thoughtCount: this.negativeThoughts.length
    }
  }
}