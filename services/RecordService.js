/**
 * 记录业务逻辑服务
 * 管理当前记录的创建、编辑、保存等业务流程
 */

import { EmotionRecord } from '../models/EmotionRecord.js'
import StorageService from './StorageService.js'
import MarkdownService from './MarkdownService.js'

class RecordService {
  constructor() {
    this.currentRecord = null
  }

  /**
   * 创建新记录
   */
  createNewRecord() {
    this.currentRecord = new EmotionRecord()
    console.log('创建新记录:', this.currentRecord.id)
    return this.currentRecord
  }

  /**
   * 加载已有记录
   * @param {EmotionRecord|Object} record
   */
  loadRecord(record) {
    if (record instanceof EmotionRecord) {
      this.currentRecord = record
    } else {
      this.currentRecord = EmotionRecord.fromJSON(record)
    }
    console.log('加载记录:', this.currentRecord.id)
    return this.currentRecord
  }

  /**
   * 获取当前记录
   */
  getCurrentRecord() {
    if (!this.currentRecord) {
      this.createNewRecord()
    }
    return this.currentRecord
  }

  /**
   * 保存到历史记录
   * @returns {Promise<void>}
   */
  async saveToHistory() {
    if (!this.currentRecord) {
      throw new Error('没有可保存的记录')
    }

    // 更新时间戳
    this.currentRecord.timestamp = Date.now()

    await StorageService.addRecord(this.currentRecord)
    console.log('记录已保存到历史')
  }

  /**
   * 导出为Markdown
   * @returns {string}
   */
  exportMarkdown() {
    if (!this.currentRecord) {
      throw new Error('没有可导出的记录')
    }

    return MarkdownService.export(this.currentRecord)
  }

  /**
   * 从Markdown导入
   * @param {string} markdown
   * @returns {EmotionRecord}
   */
  importMarkdown(markdown) {
    const record = MarkdownService.import(markdown)
    this.loadRecord(record)
    return record
  }

  /**
   * 重置当前记录
   */
  reset() {
    this.createNewRecord()
    console.log('记录已重置')
  }

  /**
   * 验证当前记录
   * @returns {Object} {isValid, errors}
   */
  validate() {
    if (!this.currentRecord) {
      return {
        isValid: false,
        errors: ['没有可验证的记录']
      }
    }

    return this.currentRecord.validate()
  }

  /**
   * 加载所有历史记录
   * @returns {Promise<Array>}
   */
  async loadHistory() {
    return await StorageService.loadRecords()
  }

  /**
   * 删除历史记录
   * @param {string} recordId
   * @returns {Promise<void>}
   */
  async deleteHistory(recordId) {
    await StorageService.deleteRecord(recordId)
  }

  /**
   * 清空所有历史记录
   * @returns {Promise<void>}
   */
  async clearHistory() {
    await StorageService.clearAllRecords()
  }
}

// 导出单例
export default new RecordService()