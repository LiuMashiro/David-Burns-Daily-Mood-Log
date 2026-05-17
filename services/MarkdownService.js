import { MARKDOWN_TEMPLATE, COGNITIVE_DISTORTIONS } from '../models/Constants.js'
import { EmotionRecord, SelectedEmotion } from '../models/EmotionRecord.js'
import { NegativeThought } from '../models/NegativeThought.js'

class MarkdownService {
  static export(record) {
    let markdown = MARKDOWN_TEMPLATE.title
    markdown += MARKDOWN_TEMPLATE.eventSection + (record.eventDescription || '无') + '\n\n'
    markdown += MARKDOWN_TEMPLATE.emotionSection + MARKDOWN_TEMPLATE.emotionTableHeader
    record.emotions.forEach(emotion => {
      const emotionsText = emotion.getAllEmotions().join(', ')
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
    if (record.negativeThoughts.some(t => t.ifThenQuestions.length > 0)) {
      markdown += MARKDOWN_TEMPLATE.ifThenSection
      record.negativeThoughts.forEach((thought, index) => {
        if (thought.ifThenQuestions.length > 0) {
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

  static import(markdown) {
    try {
      const record = new EmotionRecord()
      const lines = markdown.split('\n')
      let currentSection = ''
      let currentThoughtIndex = -1

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim()
        
        // 切换区块状态
        if (line.startsWith('## 事件')) { currentSection = 'event'; continue; }
        if (line.startsWith('## 情绪记录')) { currentSection = 'emotion'; continue; }
        if (line.startsWith('## 认知重构')) { currentSection = 'thought'; continue; }
        if (line.startsWith('## 追问详情')) { currentSection = 'ifthen'; continue; }

        // 解析事件
        if (currentSection === 'event' && line && !line.startsWith('#')) {
          record.eventDescription += (record.eventDescription ? '\n' : '') + line
        }
        // 解析情绪表格
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
        // 解析想法表格
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
        // 解析追问
        else if (currentSection === 'ifthen') {
          if (line.startsWith('### 消极想法')) {
            const match = line.match(/\d+/)
            if (match) currentThoughtIndex = parseInt(match[0]) - 1
          } else if (line.startsWith('- 如果是真的会怎样？') && currentThoughtIndex >= 0) {
            const answer = line.replace('- 如果是真的会怎样？', '').trim()
            record.negativeThoughts[currentThoughtIndex].addIfThenQuestion(this._unescapeMarkdown(answer))
          }
        }
      }
      return record
    } catch (error) {
      console.error('Markdown解析错误:', error)
      throw new Error('格式解析失败，请检查文本。')
    }
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