/**
 * ThingsBoard 菜单仪表板创建器
 * 功能：创建带有特定菜单标签的仪表板，用于菜单系统
 */

const axios = require('axios');

// 配置
const config = {
  tbUrl: 'http://localhost:8080',
  username: 'tenant@thingsboard.org',
  password: 'tenant',
  
  // 要创建的菜单仪表板列表
  menuDashboards: [
    { title: '首页', menuTag: 'menu:home', icon: 'home' },
    { title: '猪场管理', menuTag: 'menu:pigfarm', icon: 'adjust' },
    { title: '单元管理', menuTag: 'menu:unit', icon: 'view_module' },
    { title: '猪栏管理', menuTag: 'menu:pen', icon: 'crop_square' },
    { title: '饲喂曲线', menuTag: 'menu:feed-curve', icon: 'show_chart' },
    { title: '饲喂计划', menuTag: 'menu:feed-plan', icon: 'calendar_today' },
    { title: '管道配置', menuTag: 'menu:pipeline', icon: 'settings_input_component' },
    { title: '饲喂配方', menuTag: 'menu:recipe', icon: 'receipt' }
  ]
};

// 主函数
async function createMenuDashboards() {
  try {
    console.log('登录ThingsBoard...');
    const token = await login(config.username, config.password);
    
    console.log('开始创建菜单仪表板...');
    for (const dashboard of config.menuDashboards) {
      try {
        const createdDashboard = await createDashboard({
          title: dashboard.title,
          tags: [dashboard.menuTag, 'menu-dashboard'],
          icon: dashboard.icon,
          configuration: createBasicConfiguration(dashboard.title, dashboard.icon)
        }, token);
        
        console.log(`✅ 创建成功: "${createdDashboard.title}" (ID: ${createdDashboard.id.id}) 标签: ${createdDashboard.tags.join(', ')}`);
      } catch (error) {
        console.error(`❌ 创建 "${dashboard.title}" 失败:`, error.message);
      }
    }
    
  } catch (error) {
    console.error('操作失败:', error.message);
  }
}

// 登录
async function login(username, password) {
  const response = await axios.post(`${config.tbUrl}/api/auth/login`, {
    username, password
  });
  return response.data.token;
}

// 创建仪表板
async function createDashboard(dashboardData, token) {
  const response = await axios.post(
    `${config.tbUrl}/api/dashboard`,
    dashboardData,
    {
      headers: {
        'Content-Type': 'application/json',
        'X-Authorization': `Bearer ${token}`
      }
    }
  );
  return response.data;
}

// 创建基本配置
function createBasicConfiguration(title, icon) {
  return JSON.stringify({
    description: `自动创建的菜单仪表板: ${title}`,
    widgets: {},
    states: {
      default: {
        name: 'Default',
        root: true,
        layouts: {
          main: {
            widgets: {},
            gridSettings: {
              backgroundColor: '#eeeeee',
              columns: 24,
              margin: 10,
              backgroundSizeMode: '100%'
            }
          }
        }
      }
    },
    entityAliases: {},
    filters: {},
    timewindow: {
      realtime: {
        timewindowMs: 60000
      }
    },
    settings: {
      stateControllerId: 'entity',
      showTitle: true,
      showDashboardLogo: false,
      showDashboardsSelect: true,
      showEntitiesSelect: true,
      showDashboardTimewindow: true,
      showDashboardExport: true,
      toolbarAlwaysOpen: true
    }
  });
}

// 执行主函数
createMenuDashboards();
