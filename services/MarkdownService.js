import { MARKDOWN_TEMPLATE, COGNITIVE_DISTORTIONS } from '../models/Constants.js'
import { EmotionRecord, SelectedEmotion } from '../models/EmotionRecord.js'
import { NegativeThought } from '../models/NegativeThought.js'
import { formatDate } from '../utils/util.js'

class MarkdownService {
  
  static exportAll(records) {
    if (!records || records.length === 0) return ''
    return records.map(record => this._exportSingle(record)).join(MARKDOWN_TEMPLATE.divider)
  }

  static export(record) {
    return this._exportSingle(record)
  }

  static _exportSingle(record) {
    let markdown = MARKDOWN_TEMPLATE.title
    markdown += MARKDOWN_TEMPLATE.dateSection + formatDate(record.timestamp || Date.now(), 'YYYY-MM-DD HH:mm:ss') + '\n\n'
    markdown += MARKDOWN_TEMPLATE.eventSection + (record.eventDescription || '无') + '\n\n'
    markdown += MARKDOWN_TEMPLATE.emotionSection + MARKDOWN_TEMPLATE.emotionTableHeader
    
    // 兼容原生的实体类与纯脱水 JSON 对象
    record.emotions.forEach(emotion => {
      const emotionList = typeof emotion.getAllEmotions === 'function' 
        ? emotion.getAllEmotions() 
        : [...(emotion.selectedEmotions || []), ...(emotion.customEmotions || [])]
      
      const emotionsText = emotionList.join(', ')
      markdown += `| ${emotion.categoryName} | ${emotionsText} | ${emotion.beforeIntensity} | ${emotion.afterIntensity} |\n`
    })

    markdown += '\n' + MARKDOWN_TEMPLATE.thoughtSection + MARKDOWN_TEMPLATE.thoughtTableHeader
    
    record.negativeThoughts.forEach(thought => {
      const distortionsText = thought.distortions.map(id => {
        const d = COGNITIVE_DISTORTIONS.find(c => c.id === id)
        return d ? d.name : id
      }).join(', ')
      markdown += `| ${this._escapeMarkdown(thought.content)} | ${thought.beforeBelief} | ${thought.afterBelief} | ${distortionsText} | ${this._escapeMarkdown(thought.positiveThought)} | ${thought.positiveBeliefBefore} |\n`
    })
    
    markdown += '\n'
    if (record.negativeThoughts.some(t => t.ifThenQuestions && t.ifThenQuestions.length > 0)) {
      markdown += MARKDOWN_TEMPLATE.ifThenSection
      record.negativeThoughts.forEach((thought, index) => {
        if (thought.ifThenQuestions && thought.ifThenQuestions.length > 0) {
          markdown += `### 消极想法 ${index + 1}: ${this._escapeMarkdown(thought.content)}\n\n`
          thought.ifThenQuestions.forEach(q => {
            markdown += `- 就算是真的会怎样？${this._escapeMarkdown(q.answer)}\n`
          })
          markdown += '\n'
        }
      })
    }
    return markdown
  }

  static importAll(markdownText) {
    try {
      // 按照多条记录导出时的标题切分记录
      const rawBlocks = markdownText.split(/# 伯恩斯情绪记录/)
      const records = []
      
      rawBlocks.forEach(block => {
        if (block.trim() === '') return
        // 补回切掉的标题标志，复用单条解析逻辑
        const record = this._importSingle('# 伯恩斯情绪记录' + block)
        if (record) records.push(record)
      })
      
      if (records.length === 0) throw new Error('未找到有效的记录片段')
      return records
    } catch (error) {
      console.error('批量Markdown解析错误:', error)
      throw new Error('批量格式解析失败，请检查格式或确保不使用旧版数据。')
    }
  }

  static import(markdown) {
    const records = this.importAll(markdown)
    return records[0]
  }

  static _importSingle(markdown) {
    const record = new EmotionRecord()
    const lines = markdown.split('\n')
    let currentSection = ''
    let currentThoughtIndex = -1

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      
      if (line.startsWith('> 记录时间：')) {
        const dateStr = line.replace('> 记录时间：', '').trim()
        const ts = new Date(dateStr).getTime()
        if (!isNaN(ts)) record.timestamp = ts
        continue
      }
      
      if (line.startsWith('## 事件')) { currentSection = 'event'; continue; }
      if (line.startsWith('## 情绪记录')) { currentSection = 'emotion'; continue; }
      if (line.startsWith('## 认知重构')) { currentSection = 'thought'; continue; }
      if (line.startsWith('## 追问详情')) { currentSection = 'ifthen'; continue; }

      if (currentSection === 'event' && line && !line.startsWith('#') && !line.startsWith('---')) {
        record.eventDescription += (record.eventDescription ? '\n' : '') + line
      }
      else if (currentSection === 'emotion' && line.startsWith('|')) {
        if (line.includes('情绪类别') || line.includes('---')) continue;
        const cells = line.split('|').map(c => c.trim()).filter(c => c)
        if (cells.length >= 4) {
          const categoryName = cells[0]
          const emotion = new SelectedEmotion(this._getCategoryIdByName(categoryName), categoryName)
          emotion.selectedEmotions = cells[1].split(',').map(e => e.trim()).filter(e => e)
          emotion.beforeIntensity = parseInt(cells[2]) || 100
          emotion.afterIntensity = parseInt(cells[3]) || 100
          record.emotions.push(emotion)
        }
      }
      else if (currentSection === 'thought' && line.startsWith('|')) {
        if (line.includes('消极想法') || line.includes('---')) continue;
        const cells = line.split('|').map(c => c.trim()).filter(c => c)
        if (cells.length >= 6) {
          const thought = new NegativeThought()
          thought.content = this._unescapeMarkdown(cells[0])
          thought.beforeBelief = parseInt(cells[1]) || 100
          thought.afterBelief = parseInt(cells[2]) || 100
          thought.distortions = cells[3].split(',').map(name => {
            const d = COGNITIVE_DISTORTIONS.find(c => c.name === name.trim())
            return d ? d.id : name.trim()
          }).filter(d => d)
          thought.positiveThought = this._unescapeMarkdown(cells[4])
          thought.positiveBeliefBefore = parseInt(cells[5]) || 0
          record.negativeThoughts.push(thought)
        }
      }
      else if (currentSection === 'ifthen') {
        if (line.startsWith('### 消极想法')) {
          const match = line.match(/\d+/)
          if (match) currentThoughtIndex = parseInt(match[0]) - 1
        } else if (line.startsWith('- 就算是真的会怎样？') && currentThoughtIndex >= 0) {
          const answer = line.replace('- 就算是真的会怎样？', '').trim()
          record.negativeThoughts[currentThoughtIndex].addIfThenQuestion(this._unescapeMarkdown(answer))
        }
      }
    }
    
    if (!record.eventDescription && record.emotions.length === 0) return null
    return record
  }

  static _escapeMarkdown(text) { return !text ? '' : text.replace(/\|/g, '\\|').replace(/\n/g, ' ') }
  static _unescapeMarkdown(text) { return !text ? '' : text.replace(/\\\|/g, '|') }
  static _getCategoryIdByName(name) {
    const { EMOTION_CATEGORIES } = require('../models/Constants.js')
    const category = EMOTION_CATEGORIES.find(c => c.name === name)
    return category ? category.id : name.toLowerCase().replace(/\s+/g, '_')
  }
}
export default MarkdownService