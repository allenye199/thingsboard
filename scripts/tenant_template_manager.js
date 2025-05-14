/**
 * ThingsBoard 租户模板管理工具
 * 功能：导出模板租户配置并应用到新租户
 * 
 * 使用说明:
 * 1. 导出模板: node tenant_template_manager.js export <模板租户ID> <输出目录>
 * 2. 导入模板: node tenant_template_manager.js import <新租户ID> <模板目录>
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const commander = require('commander');
const chalk = require('chalk');

// 配置
const CONFIG = {
  tbUrl: 'http://localhost:8080',
  username: 'sysadmin@thingsboard.org', // 系统管理员账户
  password: 'sysadmin'
};

// 要导出的实体类型列表
const ENTITY_TYPES = [
  'DASHBOARD', 
  'DEVICE', 
  'ASSET',
  'ENTITY_VIEW',
  'WIDGETS_BUNDLE',
  'WIDGET_TYPE',
  'DEVICE_PROFILE',
  'ASSET_PROFILE',
  'RULE_CHAIN'
];

// 命令行参数配置
const program = new commander.Command();

program
  .name('tenant-template-manager')
  .description('ThingsBoard租户配置模板管理工具');

program.command('export')
  .description('导出租户配置作为模板')
  .argument('<tenantId>', '源模板租户ID')
  .argument('<outputDir>', '输出目录')
  .option('-f, --force', '强制覆盖现有文件')
  .action(exportTenantTemplate);

program.command('import')
  .description('将模板配置导入新租户')
  .argument('<tenantId>', '目标租户ID')
  .argument('<templateDir>', '模板目录')
  .action(importTenantTemplate);

program.parse();

// 主函数：导出租户模板
async function exportTenantTemplate(tenantId, outputDir, options) {
  try {
    console.log(chalk.blue('====== ThingsBoard租户模板导出工具 ======'));
    console.log(chalk.cyan(`准备从租户 ${tenantId} 导出配置...`));
    
    // 验证输出目录
    const templateDir = path.resolve(outputDir);
    if (fs.existsSync(templateDir)) {
      if (!options.force) {
        console.log(chalk.yellow(`输出目录 "${templateDir}" 已存在，使用 --force 选项覆盖`));
        process.exit(1);
      }
    } else {
      fs.mkdirSync(templateDir, { recursive: true });
      console.log(chalk.green(`创建输出目录: ${templateDir}`));
    }
    
    // 登录
    const token = await login(CONFIG.username, CONFIG.password);
    console.log(chalk.green('登录成功，开始导出过程...'));
    
    const result = {
      dashboards: [],
      devices: [],
      assets: [],
      entityViews: [],
      widgetsBundles: [],
      widgetTypes: [],
      deviceProfiles: [],
      assetProfiles: [],
      ruleChains: []
    };

    // 按实体类型分别导出
    for (const entityType of ENTITY_TYPES) {
      try {
        console.log(chalk.cyan(`导出${entityType}...`));
        const entities = await exportEntities(tenantId, entityType, token, templateDir);
        
        // 存储到相应的结果数组
        switch(entityType) {
          case 'DASHBOARD': result.dashboards = entities; break;
          case 'DEVICE': result.devices = entities; break;
          case 'ASSET': result.assets = entities; break;
          case 'ENTITY_VIEW': result.entityViews = entities; break;
          case 'WIDGETS_BUNDLE': result.widgetsBundles = entities; break;
          case 'WIDGET_TYPE': result.widgetTypes = entities; break;
          case 'DEVICE_PROFILE': result.deviceProfiles = entities; break;
          case 'ASSET_PROFILE': result.assetProfiles = entities; break;
          case 'RULE_CHAIN': result.ruleChains = entities; break;
        }
      } catch(err) {
        console.error(chalk.red(`导出${entityType}失败:`, err.message));
      }
    }
    
    // 导出实体间的关系
    await exportRelations(tenantId, token, templateDir);
    
    // 保存全局索引
    const indexPath = path.join(templateDir, 'template_index.json');
    fs.writeFileSync(indexPath, JSON.stringify(result, null, 2));
    
    console.log(chalk.green(`\n✅ 模板导出完成! 保存到: ${templateDir}`));
    console.log(chalk.blue('============================================='));
    
  } catch (error) {
    console.error(chalk.red('导出过程失败:', error.message));
    process.exit(1);
  }
}

// 主函数：导入租户模板
async function importTenantTemplate(tenantId, templateDir, options) {
  try {
    console.log(chalk.blue('====== ThingsBoard租户模板导入工具 ======'));
    console.log(chalk.cyan(`准备将模板从 ${templateDir} 导入到租户 ${tenantId}...`));
    
    // 验证模板目录
    const srcDir = path.resolve(templateDir);
    if (!fs.existsSync(srcDir) || !fs.existsSync(path.join(srcDir, 'template_index.json'))) {
      console.error(chalk.red(`错误: "${srcDir}" 不是有效的模板目录`));
      process.exit(1);
    }
    
    // 登录
    const token = await login(CONFIG.username, CONFIG.password);
    console.log(chalk.green('登录成功，开始导入过程...'));
    
    // 加载模板索引
    const indexPath = path.join(srcDir, 'template_index.json');
    const templateIndex = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
    
    // 创建ID映射表，用于处理实体引用关系
    const idMappings = {
      DASHBOARD: {},
      DEVICE: {},
      ASSET: {},
      ENTITY_VIEW: {},
      WIDGETS_BUNDLE: {},
      WIDGET_TYPE: {},
      DEVICE_PROFILE: {},
      ASSET_PROFILE: {},
      RULE_CHAIN: {}
    };
    
    // 按导入优先级顺序导入实体
    // 首先导入配置文件和小部件
    await importEntityType('DEVICE_PROFILE', tenantId, srcDir, token, idMappings);
    await importEntityType('ASSET_PROFILE', tenantId, srcDir, token, idMappings);
    await importEntityType('WIDGETS_BUNDLE', tenantId, srcDir, token, idMappings);
    await importEntityType('WIDGET_TYPE', tenantId, srcDir, token, idMappings);
    
    // 然后导入规则链
    await importEntityType('RULE_CHAIN', tenantId, srcDir, token, idMappings);
    
    // 接着导入设备、资产和实体视图
    await importEntityType('DEVICE', tenantId, srcDir, token, idMappings);
    await importEntityType('ASSET', tenantId, srcDir, token, idMappings);
    await importEntityType('ENTITY_VIEW', tenantId, srcDir, token, idMappings);
    
    // 最后导入仪表板（因为它们可能引用其他实体）
    await importEntityType('DASHBOARD', tenantId, srcDir, token, idMappings);
    
    // 导入实体关系
    await importRelations(tenantId, srcDir, token, idMappings);
    
    // 保存ID映射，以便后续使用
    const mappingsPath = path.join(srcDir, 'id_mappings.json');
    fs.writeFileSync(mappingsPath, JSON.stringify(idMappings, null, 2));
    
    console.log(chalk.green(`\n✅ 模板导入完成! ID映射已保存到: ${mappingsPath}`));
    console.log(chalk.blue('============================================='));
    
  } catch (error) {
    console.error(chalk.red('导入过程失败:', error.message));
    process.exit(1);
  }
}

// 登录并获取JWT令牌
async function login(username, password) {
  try {
    const response = await axios.post(`${CONFIG.tbUrl}/api/auth/login`, { 
      username, 
      password 
    });
    return response.data.token;
  } catch (error) {
    throw new Error(`登录失败: ${error.response?.data?.message || error.message}`);
  }
}

// 导出指定类型的实体
async function exportEntities(tenantId, entityType, token, outputDir) {
  const entities = await fetchEntities(tenantId, entityType, token);
  console.log(chalk.green(`找到 ${entities.length} 个 ${entityType} 实体`));
  
  // 创建类型子目录
  const typeDir = path.join(outputDir, entityType.toLowerCase());
  if (!fs.existsSync(typeDir)) {
    fs.mkdirSync(typeDir, { recursive: true });
  }
  
  // 导出每个实体详情
  const exportedEntities = [];
  for (const entity of entities) {
    try {
      // 获取完整实体详情
      const detailedEntity = await fetchEntityDetails(entityType, entity.id.id, token);
      
      // 保存文件
      const safeFileName = `${sanitizeFileName(detailedEntity.name || detailedEntity.title)}_${entity.id.id}.json`;
      const filePath = path.join(typeDir, safeFileName);
      fs.writeFileSync(filePath, JSON.stringify(detailedEntity, null, 2));
      
      console.log(chalk.green(`✓ ${entityType}: ${detailedEntity.name || detailedEntity.title}`));
      exportedEntities.push({
        id: entity.id,
        name: detailedEntity.name || detailedEntity.title,
        filePath: path.relative(outputDir, filePath)
      });
    } catch (error) {
      console.error(chalk.red(`导出详情失败: ${entity.name || entity.title}:`, error.message));
    }
  }
  
  return exportedEntities;
}

// 导出实体关系
async function exportRelations(tenantId, token, outputDir) {
  console.log(chalk.cyan('导出实体关系...'));
  
  try {
    // 获取所有关系
    const response = await axios.get(
      `${CONFIG.tbUrl}/api/relations?fromId=${tenantId}&fromType=TENANT`,
      { headers: { 'X-Authorization': `Bearer ${token}` } }
    );
    
    const relations = response.data || [];
    console.log(chalk.green(`找到 ${relations.length} 个关系`));
    
    // 保存关系到文件
    const relationsPath = path.join(outputDir, 'relations.json');
    fs.writeFileSync(relationsPath, JSON.stringify(relations, null, 2));
    
    return relations;
  } catch (error) {
    console.error(chalk.red('获取关系失败:', error.message));
    return [];
  }
}

// 获取实体列表
async function fetchEntities(tenantId, entityType, token) {
  try {
    let url;
    let params = { pageSize: 1000 };
    
    switch (entityType) {
      case 'DASHBOARD':
        url = `${CONFIG.tbUrl}/api/tenant/${tenantId}/dashboards`;
        break;
      case 'DEVICE':
        url = `${CONFIG.tbUrl}/api/tenant/${tenantId}/devices`;
        break;
      case 'ASSET':
        url = `${CONFIG.tbUrl}/api/tenant/${tenantId}/assets`;
        break;
      case 'ENTITY_VIEW':
        url = `${CONFIG.tbUrl}/api/tenant/${tenantId}/entityViews`;
        break;
      case 'WIDGETS_BUNDLE':
        url = `${CONFIG.tbUrl}/api/widgetsBundles`;
        params.tenantId = tenantId;
        break;
      case 'WIDGET_TYPE':
        // 对小部件类型，我们需要先获取所有小部件包
        const bundlesResponse = await axios.get(
          `${CONFIG.tbUrl}/api/widgetsBundles`,
          { 
            headers: { 'X-Authorization': `Bearer ${token}` },
            params: { tenantId: tenantId }
          }
        );
        
        let allWidgets = [];
        for (const bundle of bundlesResponse.data.data) {
          const widgetsResponse = await axios.get(
            `${CONFIG.tbUrl}/api/widgetsBundle/${bundle.id.id}/widgetTypes`,
            { headers: { 'X-Authorization': `Bearer ${token}` } }
          );
          allWidgets = allWidgets.concat(widgetsResponse.data);
        }
        return allWidgets;
      case 'DEVICE_PROFILE':
        url = `${CONFIG.tbUrl}/api/deviceProfiles`;
        break;
      case 'ASSET_PROFILE':
        url = `${CONFIG.tbUrl}/api/assetProfiles`;
        break;
      case 'RULE_CHAIN':
        url = `${CONFIG.tbUrl}/api/ruleChains`;
        break;
      default:
        throw new Error(`不支持的实体类型: ${entityType}`);
    }
    
    const response = await axios.get(url, { 
      headers: { 'X-Authorization': `Bearer ${token}` },
      params: params
    });
    
    // 处理分页数据格式
    return response.data.data || response.data;
  } catch (error) {
    throw new Error(`获取${entityType}列表失败: ${error.response?.data?.message || error.message}`);
  }
}

// 获取实体详情
async function fetchEntityDetails(entityType, entityId, token) {
  try {
    let url;
    let params = {};
    
    switch (entityType) {
      case 'DASHBOARD':
        url = `${CONFIG.tbUrl}/api/dashboard/${entityId}`;
        params.inlineImages = true;
        break;
      case 'DEVICE':
        url = `${CONFIG.tbUrl}/api/device/${entityId}`;
        break;
      case 'ASSET':
        url = `${CONFIG.tbUrl}/api/asset/${entityId}`;
        break;
      case 'ENTITY_VIEW':
        url = `${CONFIG.tbUrl}/api/entityView/${entityId}`;
        break;
      case 'WIDGETS_BUNDLE':
        url = `${CONFIG.tbUrl}/api/widgetsBundle/${entityId}`;
        break;
      case 'WIDGET_TYPE':
        url = `${CONFIG.tbUrl}/api/widgetType/${entityId}`;
        break;
      case 'DEVICE_PROFILE':
        url = `${CONFIG.tbUrl}/api/deviceProfile/${entityId}`;
        break;
      case 'ASSET_PROFILE':
        url = `${CONFIG.tbUrl}/api/assetProfile/${entityId}`;
        break;
      case 'RULE_CHAIN':
        url = `${CONFIG.tbUrl}/api/ruleChain/${entityId}`;
        break;
      default:
        throw new Error(`不支持的实体类型详情: ${entityType}`);
    }
    
    const response = await axios.get(url, { 
      headers: { 'X-Authorization': `Bearer ${token}` },
      params: params
    });
    
    return response.data;
  } catch (error) {
    throw new Error(`获取${entityType}详情失败: ${error.response?.data?.message || error.message}`);
  }
}

// 导入特定类型的实体
async function importEntityType(entityType, tenantId, templateDir, token, idMappings) {
  console.log(chalk.cyan(`导入${entityType}...`));
  
  const typeDir = path.join(templateDir, entityType.toLowerCase());
  if (!fs.existsSync(typeDir)) {
    console.log(chalk.yellow(`警告: ${entityType}目录不存在，跳过`));
    return;
  }
  
  // 获取该类型的所有文件
  const files = fs.readdirSync(typeDir).filter(file => file.endsWith('.json'));
  
  // 导入计数器
  let successCount = 0;
  let failCount = 0;
  
  for (const file of files) {
    try {
      const filePath = path.join(typeDir, file);
      const entityData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      
      // 准备导入数据（移除ID等）
      const preparedData = prepareEntityForImport(entityData, entityType, tenantId);
      
      // 创建新实体
      const newEntity = await createEntity(entityType, preparedData, token);
      
      // 保存ID映射关系
      if (entityData.id && entityData.id.id && newEntity.id && newEntity.id.id) {
        idMappings[entityType][entityData.id.id] = newEntity.id.id;
      }
      
      // 成功计数
      successCount++;
      console.log(chalk.green(`✓ ${entityType}: ${newEntity.name || newEntity.title} (ID: ${newEntity.id.id})`));
      
    } catch (error) {
      failCount++;
      console.error(chalk.red(`导入${file}失败:`, error.message));
    }
  }
  
  console.log(chalk.cyan(`${entityType}导入完成: 成功${successCount}，失败${failCount}`));
}

// 导入实体关系
async function importRelations(tenantId, templateDir, token, idMappings) {
  console.log(chalk.cyan('导入实体关系...'));
  
  const relationsPath = path.join(templateDir, 'relations.json');
  if (!fs.existsSync(relationsPath)) {
    console.log(chalk.yellow('警告: 关系文件不存在，跳过'));
    return;
  }
  
  // 加载关系配置
  const relations = JSON.parse(fs.readFileSync(relationsPath, 'utf8'));
  
  // 导入计数器
  let successCount = 0;
  let failCount = 0;
  
  for (const relation of relations) {
    try {
      // 更新from和to引用的实体ID（如果在映射中）
      const newRelation = {
        ...relation,
        from: updateEntityReference(relation.from, idMappings),
        to: updateEntityReference(relation.to, idMappings)
      };
      
      // 只有当两端ID都有效时才创建关系
      if (newRelation.from.id && newRelation.to.id) {
        await createRelation(newRelation, token);
        successCount++;
      } else {
        console.log(chalk.yellow(`跳过关系: ${relation.type}，缺少ID映射`));
        failCount++;
      }
    } catch (error) {
      failCount++;
      console.error(chalk.red(`创建关系失败:`, error.message));
    }
  }
  
  console.log(chalk.cyan(`关系导入完成: 成功${successCount}，失败${failCount}`));
}

// 更新实体引用
function updateEntityReference(entityRef, idMappings) {
  if (!entityRef || !entityRef.id || !entityRef.entityType) {
    return entityRef;
  }
  
  const newId = idMappings[entityRef.entityType] && idMappings[entityRef.entityType][entityRef.id];
  
  if (newId) {
    return {
      ...entityRef,
      id: newId
    };
  }
  
  return entityRef;
}

// 准备实体用于导入
function prepareEntityForImport(entity, entityType, tenantId) {
  // 创建深拷贝以避免修改原始对象
  const newEntity = JSON.parse(JSON.stringify(entity));
  
  // 移除ID以创建新实例
  delete newEntity.id;
  
  // 设置正确的租户ID
  if (entityType !== 'TENANT') {
    newEntity.tenantId = {
      entityType: 'TENANT',
      id: tenantId
    };
  }
  
  // 特殊处理仪表板配置
  if (entityType === 'DASHBOARD' && newEntity.configuration) {
    // 如果仪表板配置是字符串，解析后再处理
    if (typeof newEntity.configuration === 'string') {
      try {
        newEntity.configuration = JSON.parse(newEntity.configuration);
      } catch (e) {
        console.log(chalk.yellow('警告: 无法解析仪表板配置JSON，保持原样'));
      }
    }
    
    // TODO: 替换仪表板配置中的实体ID引用
    // 这需要深度扫描整个配置对象，寻找实体引用并替换
  }
  
  return newEntity;
}

// 创建实体
async function createEntity(entityType, entityData, token) {
  try {
    let url;
    
    switch (entityType) {
      case 'DASHBOARD':
        url = `${CONFIG.tbUrl}/api/dashboard`;
        break;
      case 'DEVICE':
        url = `${CONFIG.tbUrl}/api/device`;
        break;
      case 'ASSET':
        url = `${CONFIG.tbUrl}/api/asset`;
        break;
      case 'ENTITY_VIEW':
        url = `${CONFIG.tbUrl}/api/entityView`;
        break;
      case 'WIDGETS_BUNDLE':
        url = `${CONFIG.tbUrl}/api/widgetsBundle`;
        break;
      case 'WIDGET_TYPE':
        url = `${CONFIG.tbUrl}/api/widgetType`;
        break;
      case 'DEVICE_PROFILE':
        url = `${CONFIG.tbUrl}/api/deviceProfile`;
        break;
      case 'ASSET_PROFILE':
        url = `${CONFIG.tbUrl}/api/assetProfile`;
        break;
      case 'RULE_CHAIN':
        url = `${CONFIG.tbUrl}/api/ruleChain`;
        break;
      default:
        throw new Error(`不支持的实体类型创建: ${entityType}`);
    }
    
    const response = await axios.post(url, entityData, { 
      headers: { 
        'X-Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    return response.data;
  } catch (error) {
    throw new Error(`创建${entityType}失败: ${error.response?.data?.message || error.message}`);
  }
}

// 创建实体关系
async function createRelation(relationData, token) {
  try {
    await axios.post(`${CONFIG.tbUrl}/api/relation`, relationData, { 
      headers: { 
        'X-Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    throw new Error(`创建关系失败: ${error.response?.data?.message || error.message}`);
  }
}

// 文件名清理函数
function sanitizeFileName(name) {
  return name.replace(/[/\\?%*:|"<>]/g, '-').substring(0, 100);
}

// 如果是直接执行
if (require.main === module) {
  program.parse();
}

module.exports = {
  exportTenantTemplate,
  importTenantTemplate
};
