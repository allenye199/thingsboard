/**
 * ThingsBoard 仪表板导出工具
 * 功能：将所有仪表板导出为单独的JSON文件
 * 用法：将此脚本保存为JS文件并用Node.js执行
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');

// 配置参数
const CONFIG = {
  // ThingsBoard服务器配置
  tbUrl: 'http://localhost:8080',
  username: 'tenant@thingsboard.org', // 更改为你的用户名
  password: 'tenant',                 // 更改为你的密码
  
  // 导出配置
  outputDir: './exported_dashboards',
  includeImages: true,                // 是否包含内联图片
  pageSize: 100,                      // 每页查询的仪表板数量
  
  // 过滤器 (可选)
  filter: {
    byTag: null,                      // 按标签过滤，例如: 'template'
    byTitle: null                     // 按标题过滤，例如: 'Home'
  }
};

// 主函数
async function exportAllDashboards() {
  try {
    // 1. 登录获取令牌
    console.log('正在登录ThingsBoard获取授权令牌...');
    const token = await login(CONFIG.username, CONFIG.password);
    console.log('登录成功!');
    
    // 2. 确保输出目录存在
    if (!fs.existsSync(CONFIG.outputDir)) {
      fs.mkdirSync(CONFIG.outputDir, { recursive: true });
      console.log(`创建输出目录: ${CONFIG.outputDir}`);
    }
    
    // 3. 获取所有仪表板
    console.log('正在获取仪表板列表...');
    const dashboards = await fetchAllDashboards(token);
    console.log(`找到 ${dashboards.length} 个仪表板`);
    
    // 4. 导出每个仪表板
    let exportedCount = 0;
    for (const dashboardInfo of dashboards) {
      try {
        const dashboard = await fetchDashboardDetails(dashboardInfo.id.id, token);
        const filename = sanitizeFilename(`${dashboard.title}_${dashboard.id.id}.json`);
        const filepath = path.join(CONFIG.outputDir, filename);
        
        fs.writeFileSync(filepath, JSON.stringify(dashboard, null, 2));
        console.log(`✅ 已导出: ${dashboard.title} -> ${filename}`);
        exportedCount++;
      } catch (error) {
        console.error(`❌ 导出仪表板 ${dashboardInfo.title} 失败:`, error.message);
      }
    }
    
    console.log(`\n导出完成! 已导出 ${exportedCount}/${dashboards.length} 个仪表板到 ${CONFIG.outputDir}`);
    
  } catch (error) {
    console.error('导出过程中发生错误:', error.message);
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

// 获取所有仪表板
async function fetchAllDashboards(token) {
  let dashboards = [];
  let hasNext = true;
  let page = 0;
  
  while (hasNext) {
    try {
      let url = `${CONFIG.tbUrl}/api/tenant/dashboards?pageSize=${CONFIG.pageSize}&page=${page}`;
      
      // 添加过滤器
      if (CONFIG.filter.byTag) {
        url += `&tagName=${encodeURIComponent(CONFIG.filter.byTag)}`;
      }
      
      if (CONFIG.filter.byTitle) {
        url += `&textSearch=${encodeURIComponent(CONFIG.filter.byTitle)}`;
      }
      
      const response = await axios.get(url, {
        headers: {
          'X-Authorization': `Bearer ${token}`
        }
      });
      
      const pageData = response.data;
      
      if (pageData.data && pageData.data.length > 0) {
        dashboards = dashboards.concat(pageData.data);
        hasNext = pageData.hasNext;
        page++;
      } else {
        hasNext = false;
      }
      
    } catch (error) {
      throw new Error(`获取仪表板列表失败: ${error.response?.data?.message || error.message}`);
    }
  }
  
  return dashboards;
}

// 获取仪表板详情
async function fetchDashboardDetails(dashboardId, token) {
  try {
    const url = `${CONFIG.tbUrl}/api/dashboard/${dashboardId}`;
    const params = CONFIG.includeImages ? { inlineImages: true } : {};
    
    const response = await axios.get(url, {
      headers: {
        'X-Authorization': `Bearer ${token}`
      },
      params
    });
    
    return response.data;
  } catch (error) {
    throw new Error(`获取仪表板详情失败: ${error.response?.data?.message || error.message}`);
  }
}

// 清理文件名
function sanitizeFilename(name) {
  return name.replace(/[/\\?%*:|"<>]/g, '-');
}

// 执行主函数
exportAllDashboards();
