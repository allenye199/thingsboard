/**
 * ThingsBoard 租户模板服务
 * 功能：自动监听租户创建事件并应用模板配置
 * 
 * 注意：这个文件需要放在ThingsBoard自定义服务目录下
 */

// 引入ThingsBoard工具库
const {
  EntityType,
  ActionType,
  TbContext,
  log
} = require('custom-js-api');

// 引入模板管理工具
const templateManager = require('../scripts/tenant_template_manager');

// 默认配置
const CONFIG = {
  templateDir: process.env.TEMPLATE_DIR || '/root/thingsboard/tenant_templates/default',
  enableAutoConfig: process.env.ENABLE_AUTO_CONFIG === 'true' || true,
  logLevel: process.env.TEMPLATE_LOG_LEVEL || 'info'
};

/**
 * 租户模板服务
 */
class TenantTemplateService {
  constructor() {
    this.initialized = false;
  }
  
  /**
   * 初始化服务
   */
  async init(ctx) {
    this.ctx = ctx;
    this.log = ctx.logger;
    
    this.log.info('租户模板服务初始化...');
    
    try {
      // 检查是否启用自动配置
      if (!CONFIG.enableAutoConfig) {
        this.log.warn('自动配置已禁用，服务将不会监听租户创建事件');
        return;
      }
      
      // 检查模板目录
      const fs = require('fs');
      if (!fs.existsSync(CONFIG.templateDir)) {
        this.log.error(`模板目录不存在: ${CONFIG.templateDir}`);
        return;
      }
      
      this.log.info(`租户模板服务启动成功，使用模板目录: ${CONFIG.templateDir}`);
      this.initialized = true;
      
    } catch (error) {
      this.log.error(`初始化失败: ${error.message}`);
    }
  }
  
  /**
   * 处理实体更改事件
   */
  async onEntityAction(entity, actionType, event, ctx) {
    if (!this.initialized) return;
    
    // 只监听租户创建事件
    if (entity.entityType !== EntityType.TENANT || actionType !== ActionType.ADDED) {
      return;
    }
    
    this.log.info(`检测到新租户创建: ${entity.name} (${entity.id.id})`);
    
    try {
      // 延迟执行，确保租户创建完全完成
      setTimeout(() => {
        this.applyTemplateToTenant(entity);
      }, 5000);
    } catch (error) {
      this.log.error(`处理租户创建事件失败: ${error.message}`);
    }
  }
  
  /**
   * 应用模板到租户
   */
  async applyTemplateToTenant(tenant) {
    this.log.info(`开始应用模板到租户: ${tenant.name} (${tenant.id.id})`);
    
    try {
      // 执行模板导入
      await templateManager.importTenantTemplate(tenant.id.id, CONFIG.templateDir);
      
      this.log.info(`模板成功应用到租户: ${tenant.name}`);
    } catch (error) {
      this.log.error(`应用模板失败: ${error.message}`);
    }
  }
}

// 导出服务实例
module.exports = new TenantTemplateService();
