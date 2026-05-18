import { EmotionRecord } from '../models/EmotionRecord.js'
import StorageService from './StorageService.js'
import MarkdownService from './MarkdownService.js'

class RecordService {
  constructor() { this.currentRecord = null }
  createNewRecord() { this.currentRecord = new EmotionRecord(); return this.currentRecord; }
  
  loadRecord(record) { 
    this.currentRecord = record instanceof EmotionRecord ? record : EmotionRecord.fromJSON(record); 
    return this.currentRecord; 
  }
  
  getCurrentRecord() { 
    if (!this.currentRecord) this.createNewRecord(); 
    return this.currentRecord; 
  }
  
  async saveToHistory() {
    if (!this.currentRecord) throw new Error('没有可保存的记录')
    if (!this.currentRecord.timestamp) this.currentRecord.timestamp = Date.now()
    await StorageService.addRecord(this.currentRecord)
  }
  
  exportMarkdown() { return MarkdownService.export(this.getCurrentRecord()) }
  exportAllHistory(records) { return MarkdownService.exportAll(records) }
  
  importMarkdown(markdown) {
    const record = MarkdownService.import(markdown)
    this.loadRecord(record)
    return record
  }
  
  async importAllToHistory(markdown) {
    const records = MarkdownService.importAll(markdown)
    for (let record of records) {
      await StorageService.addRecord(record)
    }
    return records.length
  }

  reset() { this.createNewRecord() }
  
  validate() { return this.currentRecord ? this.currentRecord.validate() : { isValid: false, errors: ['没有记录'] } }
  
  async loadHistory() { 
    const rawRecords = await StorageService.loadRecords()
    return rawRecords.map(raw => EmotionRecord.fromJSON(raw))
  }
  
  async deleteHistory(recordId) { await StorageService.deleteRecord(recordId) }
  async clearHistory() { await StorageService.clearAllRecords() }
}
export default new RecordService()