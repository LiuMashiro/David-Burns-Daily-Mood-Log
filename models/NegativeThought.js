/**
 * 消极想法领域模型
 * 封装消极想法及其认知重构过程
 */

export class IfThenQuestion {
  constructor(answer = '') {
    this.id = this.generateId()
    this.answer = answer
  }

  generateId() {
    return `question_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  toJSON() {
    return {
      id: this.id,
      answer: this.answer
    }
  }

  static fromJSON(json) {
    const question = new IfThenQuestion(json.answer)
    question.id = json.id
    return question
  }
}

export class NegativeThought {
  constructor() {
    this.id = this.generateId()
    this.content = '' // 消极想法内容
    this.beforeBelief = 100 // 之前相信程度（默认100）
    this.afterBelief = 100 // 之后相信程度
    this.distortions = [] // 认知扭曲类型列表
    this.ifThenQuestions = [] // "如果法"追问列表
    this.positiveThought = '' // 积极想法
    this.positiveBeliefBefore = 100 // 积极想法相信程度默认 100
  }

  generateId() {
    return `thought_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  addIfThenQuestion(answer = '') {
    const question = new IfThenQuestion(answer)
    this.ifThenQuestions.push(question)
    return question
  }

  removeIfThenQuestion(questionId) {
    this.ifThenQuestions = this.ifThenQuestions.filter(q => q.id !== questionId)
  }

  getBeliefChange() {
    return this.beforeBelief - this.afterBelief
  }

  isComplete() {
    return this.content.trim() !== '' && this.distortions.length > 0
  }

  toJSON() {
    return {
      id: this.id,
      content: this.content,
      beforeBelief: this.beforeBelief,
      afterBelief: this.afterBelief,
      distortions: this.distortions,
      ifThenQuestions: this.ifThenQuestions.map(q => q.toJSON ? q.toJSON() : q),
      positiveThought: this.positiveThought,
      positiveBeliefBefore: this.positiveBeliefBefore
    }
  }

  static fromJSON(json) {
    const thought = new NegativeThought()
    thought.id = json.id
    thought.content = json.content || ''
    thought.beforeBelief = json.beforeBelief !== undefined ? json.beforeBelief : 100
    thought.afterBelief = json.afterBelief !== undefined ? json.afterBelief : 100
    thought.distortions = json.distortions || []
    thought.ifThenQuestions = (json.ifThenQuestions || []).map(q =>
      q.id ? IfThenQuestion.fromJSON(q) : q
    )
    thought.positiveThought = json.positiveThought || ''
    thought.positiveBeliefBefore = json.positiveBeliefBefore !== undefined ? json.positiveBeliefBefore : 100
    return thought
  }
}