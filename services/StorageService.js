/**
 * 本地存储服务（深模块设计）
 * 封装所有wx.storage操作，提供简洁接口
 */

class StorageService {
  constructor() {
    this.STORAGE_KEY = 'burns_emotion_records'
    this.MAX_RECORDS = 1000 // 最大记录数量限制
  }

  /**
   * 保存记录列表
   * @param {Array} records - EmotionRecord数组
   * @returns {Promise<void>}
   */
  async saveRecords(records) {
    try {
      // 检查数量限制
      if (records.length > this.MAX_RECORDS) {
        throw new Error(`记录数量超过限制（最大${this.MAX_RECORDS}条）`)
      }

      // 序列化并保存
      const jsonData = JSON.stringify(records.map(r => r.toJSON ? r.toJSON() : r))
      
      await this._setStorageAsync(this.STORAGE_KEY, jsonData)
      console.log(`成功保存${records.length}条记录`)
    } catch (error) {
      this._handleStorageError('保存记录失败', error)
      throw error
    }
  }

  /**
   * 加载记录列表
   * @returns {Promise<Array>} - EmotionRecord数组
   */
  async loadRecords() {
    try {
      const jsonData = await this._getStorageAsync(this.STORAGE_KEY)
      
      if (!jsonData) {
        console.log('无历史记录')
        return []
      }

      const records = JSON.parse(jsonData)
      console.log(`成功加载${records.length}条记录`)
      return records
    } catch (error) {
      console.warn('加载记录失败，返回空数组', error)
      return []
    }
  }

  /**
   * 添加单条记录
   * @param {EmotionRecord} record
   * @returns {Promise<void>}
   */
  async addRecord(record) {
    try {
      const records = await this.loadRecords()
      
      // 去重：如果ID已存在，则替换
      const existingIndex = records.findIndex(r => r.id === record.id)
      if (existingIndex >= 0) {
        records[existingIndex] = record.toJSON ? record.toJSON() : record
        console.log(`更新已存在的记录: ${record.id}`)
      } else {
        records.unshift(record.toJSON ? record.toJSON() : record) // 最新的在前面
        console.log(`添加新记录: ${record.id}`)
      }

      await this.saveRecords(records)
    } catch (error) {
      this._handleStorageError('添加记录失败', error)
      throw error
    }
  }

  /**
   * 删除单条记录
   * @param {string} recordId
   * @returns {Promise<void>}
   */
  async deleteRecord(recordId) {
    try {
      const records = await this.loadRecords()
      const filteredRecords = records.filter(r => r.id !== recordId)
      
      if (filteredRecords.length === records.length) {
        console.warn(`记录不存在: ${recordId}`)
        return // 静默成功
      }

      await this.saveRecords(filteredRecords)
      console.log(`成功删除记录: ${recordId}`)
    } catch (error) {
      this._handleStorageError('删除记录失败', error)
      throw error
    }
  }

  /**
   * 清空所有记录
   * @returns {Promise<void>}
   */
  async clearAllRecords() {
    try {
      await this._removeStorageAsync(this.STORAGE_KEY)
      console.log('成功清空所有记录')
    } catch (error) {
      this._handleStorageError('清空记录失败', error)
      throw error
    }
  }

  /**
   * 获取存储信息
   * @returns {Promise<Object>}
   */
  async getStorageInfo() {
    return new Promise((resolve, reject) => {
      wx.getStorageInfo({
        success: resolve,
        fail: reject
      })
    })
  }

  // ===== 私有方法（封装复杂性） =====

  /**
   * 异步获取存储
   */
  _getStorageAsync(key) {
    return new Promise((resolve, reject) => {
      wx.getStorage({
        key: key,
        success: (res) => resolve(res.data),
        fail: (err) => {
          if (err.errMsg.includes('data not found')) {
            resolve(null)
          } else {
            reject(err)
          }
        }
      })
    })
  }

  /**
   * 异步设置存储
   */
  _setStorageAsync(key, data) {
    return new Promise((resolve, reject) => {
      wx.setStorage({
        key: key,
        data: data,
        success: resolve,
        fail: reject
      })
    })
  }

  /**
   * 异步删除存储
   */
  _removeStorageAsync(key) {
    return new Promise((resolve, reject) => {
      wx.removeStorage({
        key: key,
        success: resolve,
        fail: reject
      })
    })
  }

  /**
   * 统一错误处理
   */
  _handleStorageError(message, error) {
    console.error(message, error)
    
    // 检查是否是配额超限
    if (error.errMsg && error.errMsg.includes('quota')) {
      wx.showToast({
        title: '存储空间不足，请清理旧记录',
        icon: 'none',
        duration: 3000
      })
    }
  }
}

// 导出单例
export default new StorageService()