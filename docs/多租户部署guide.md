# ThingsBoard菜单配置导出与多租户共存方案
==============================================================
## 版本控制功能在ThingsBoard 4.0.1社区版中的支持情况

ThingsBoard 4.0.1版本的**社区版(Community Edition)**对版本控制功能有以下限制：

### 社区版中的版本控制功能

1. **基本版本控制功能受限**
   - 社区版不包含完整的版本控制(Version Control)功能
   - 不支持通过API导出/导入整个租户配置
   - 没有VC仓库管理功能

2. **可用的替代方案**
   - 社区版支持通过UI手动导出/导入单个仪表板
   - 支持通过REST API导出/导入仪表板和其他实体

### 推荐的社区版导出/导入方法

由于社区版没有完整的版本控制功能，建议使用以下方法:

1. **手动导出仪表板**
   ```bash
   # 导出单个仪表板
   curl -X GET http://localhost:8080/api/dashboard/{DASHBOARD_ID}?inlineImages=true \
     -H "X-Authorization: Bearer $JWT_TOKEN" \
     -o dashboard-export.json
   ```

2. **导出所有仪表板**
   ```bash
   # 获取所有仪表板列表
   curl -X GET http://localhost:8080/api/tenant/dashboards?pageSize=100 \
     -H "X-Authorization: Bearer $JWT_TOKEN" \
     -o dashboards-list.json
   
   # 然后通过脚本逐个导出每个仪表板
   ```

## 导入导出过程中的ID变化

**重要说明**: 当仪表板从一个租户导出并导入到另一个租户时，发生以下关键变化：

1. **仪表板ID会变化**：系统会为导入的仪表板生成新的UUID
   - 原仪表板ID: `c407b430-2e61-11f0-98e5-9b82fd9cf0ad` 
   - 导入后ID: `7ae45fc0-4b12-15f3-83e9-1d72fd8c6ad3`（示例，实际ID会不同）

2. **菜单配置问题**：由于仪表板ID变化，菜单中配置的链接也需要更新
   - 如果在`menu.models.ts`中硬编码了原仪表板ID，链接会失效
   - 需要找到一种动态关联菜单项和新仪表板ID的方法

## 使用仪表板别名而非硬编码ID

为了解决菜单中硬编码仪表板ID的问题，特别是对于"组态监控"等菜单项，我们将使用ThingsBoard内置的标签(Tags)系统：

### 仪表板标签(Tags)系统实现

ThingsBoard提供的标签系统是实现仪表板别名的理想方式：

1. **为每个仪表板添加唯一标签：**
   ```bash
   # 修改仪表板，添加特定标签
   curl -X POST http://localhost:8080/api/dashboard \
     -H "X-Authorization: Bearer $JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "id": {"id": "05fe6ed0-2e74-11f0-98e5-9b82fd9cf0ad"},
       "title": "组态监控",
       "configuration": "...",
       "tags": ["menu:configuration-monitor", "system-dashboard"]
     }'
   ```

2. **创建一个服务获取标签对应的仪表板ID：**
   ```javascript
   // dashboardTagService.js
   getDashboardIdByTag(tag) {
     return this.http.get('/api/tenant/dashboards?tagName=' + tag)
       .pipe(
         map(result => {
           if (result.data && result.data.length) {
             return result.data[0].id.id;
           }
           return null;
         })
       );
   }
   ```

### 修改菜单配置使用标签

修改`menu.models.ts`文件，将硬编码ID替换为基于标签的引用：

```typescript
// 原始代码（使用硬编码ID）
[
  MenuId.log,
  {
    id: MenuId.log,
    name: '组态监控',
    type: 'link',
    path: '/dashboards/05fe6ed0-2e74-11f0-98e5-9b82fd9cf0ad',
    icon: 'assignment',
    rootOnly: true
  }
]

// 修改后的代码（使用动态路径）
[
  MenuId.log,
  {
    id: MenuId.log,
    name: '组态监控',
    type: 'link',
    path: '/dashboard-by-tag/menu:configuration-monitor', // 使用标签引用
    icon: 'assignment',
    rootOnly: true
  }
]
```

### 实现标签解析服务

创建专用服务来根据标签查找仪表板：

```typescript
// filepath: /root/thingsboard/ui-ngx/src/app/modules/home/pages/dashboard/dashboard-tag-resolver.service.ts
import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, Resolve, Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { DashboardService } from '@core/http/dashboard.service';

@Injectable({
  providedIn: 'root'
})
export class DashboardTagResolverService implements Resolve<string> {
  
  constructor(
    private dashboardService: DashboardService,
    private router: Router
  ) {}
  
  resolve(route: ActivatedRouteSnapshot): Observable<string> {
    const tag = route.paramMap.get('tag');
    
    if (!tag) {
      this.router.navigate(['/home']);
      return of(null);
    }
    
    // 使用ThingsBoard原生API按标签查询仪表板
    return this.dashboardService.getDashboardsByTag(tag).pipe(
      map(dashboards => {
        if (dashboards && dashboards.length) {
          // 重定向到实际的仪表板ID
          this.router.navigate(['/dashboards', dashboards[0].id.id]);
          return dashboards[0].id.id;
        } else {
          this.router.navigate(['/home']);
          return null;
        }
      }),
      catchError(() => {
        this.router.navigate(['/home']);
        return of(null);
      })
    );
  }
}
```

### 添加标签路由

配置新的路由来处理基于标签的导航：

```typescript
// filepath: /root/thingsboard/ui-ngx/src/app/modules/home/pages/dashboard/dashboard-routing.module.ts
// ...existing code...

const routes: Routes = [
  // ...existing routes...
  {
    path: 'dashboard-by-tag/:tag',
    component: DashboardPageComponent,
    canActivate: [AuthGuard],
    data: {
      auth: [Authority.SYS_ADMIN, Authority.TENANT_ADMIN, Authority.CUSTOMER_USER],
      title: 'dashboard.dashboard'
    },
    resolve: {
      dashboardId: DashboardTagResolverService
    }
  }
];

// ...existing code...
```

### 标签系统特有的导入导出特性

标签系统的一个主要优势是它在导入导出过程中的良好表现：

```bash
# 导出仪表板（标签会自动包含在导出JSON中）
curl -X GET http://localhost:8080/api/dashboard/{DASHBOARD_ID}?inlineImages=true \
  -H "X-Authorization: Bearer $JWT_TOKEN" \
  -o dashboard-with-tags.json

# 导入时标签会自动保留，无需额外处理
curl -X POST http://localhost:8080/api/dashboard \
  -H "X-Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d @dashboard-with-tags.json
```

### 标签系统的优点

使用ThingsBoard标签系统的主要优势：

1. **原生支持**: 标签完全集成在ThingsBoard核心中，包括UI和API
2. **无需数据库修改**: 使用现有数据结构，不需要扩展模式
3. **简单直观**: 可通过UI直接管理标签
4. **导入导出友好**: 标签会自动包含在仪表板导出中
5. **查询性能**: 系统已针对标签查询进行优化

### 标签命名最佳实践

为确保标签的清晰度和避免冲突，建议使用命名前缀：

- `menu:配置监控` - 用于组态监控仪表板
- `menu:猪场` - 用于猪场仪表板
- `menu:饲喂计划` - 用于饲喂计划仪表板

这种方法确保菜单专用标签不会与其他用途的标签混淆。


=======================================================

## 系统共享UI元素与品牌定制

在ThingsBoard中，以下UI元素和品牌相关内容在默认情况下是被所有租户共享的：

### 1. Logo相关元素

| 元素 | 文件路径 | 共享模式 | 定制方法 |
|-----|---------|---------|---------|
| 登录页logo | `/ui-ngx/src/app/shared/components/logo.component.ts`<br>`/ui-ngx/src/assets/logo_title_white.svg` | **全局共享** | 替换资源文件 |
| 侧边栏logo | `/ui-ngx/src/assets/logo_white.svg` | **全局共享** | 替换资源文件 |
| 浏览器图标 | `/ui-ngx/src/favicon.ico` | **全局共享** | 替换资源文件 |

### 2. 翻译和文本元素

| 元素 | 文件路径 | 共享模式 | 定制方法 |
|-----|---------|---------|---------|
| 汉化文件 | `/ui-ngx/src/assets/locale/locale.constant-zh_CN.json` | **全局共享** | 修改翻译文件 |
| 版权声明 | `/ui-ngx/src/app/shared/components/footer.component.html` | **全局共享** | 修改组件代码 |

### 3. 产品版本标识

| 元素 | 文件路径 | 共享模式 | 定制方法 |
|-----|---------|---------|---------|
| "Powered by" 文本 | `/ui-ngx/src/app/shared/components/footer.component.html` | **全局共享** | 修改组件代码 |
| 版本号展示 | `/ui-ngx/src/app/core/services/config.service.ts` | **全局共享** | 修改版本定义 |

这些元素都属于**系统级资源**，在部署时会编译为统一的前端资源，因此对所有租户都是相同的。



============================================================






## 版本控制功能与多租户的关系

在ThingsBoard中，菜单配置实际上分为两个层面：

1. **系统级菜单结构**：定义在源代码中的`menu.models.ts`文件，这是全系统共享的基础结构
2. **租户级自定义内容**：各租户中配置的仪表板、小部件等内容及其链接

### 多租户共享系统级菜单

当您修改`menu.models.ts`文件更改菜单结构时，这是对系统级代码的修改，**所有租户共享同一套菜单结构**。这意味着：

- 所有租户看到的菜单项结构、图标、顺序是相同的
- 不需要为每个租户保存不同的菜单文件
- 多个租户可以同时使用这套系统，共享相同的菜单结构

### 租户级差异化内容

尽管菜单结构相同，但不同租户可以有差异化的内容：

- 每个租户有自己的仪表板内容
- 菜单项指向的具体仪表板ID可以不同
- 每个租户在相同结构下可以管理自己的实体和数据

## 导出与部署策略

要在创建新租户时应用现有配置，最佳实践是：

1. **系统级菜单结构**：通过代码部署一次，所有租户共享
2. **租户级内容模板**：使用版本控制功能导出一个"模板租户"的配置
3. **应用到新租户**：在创建新租户时导入模板租户的配置


## 结论

使用这种方法，您不需要为每个租户保存不同的菜单文件，而是：

1. 所有租户共享相同的菜单**结构**（通过系统级代码部署）
2. 每个租户有自己的**内容**（通过版本控制导出/导入模板内容）
3. 多个租户可以同时使用这套系统，各自维护自己的数据

这种方式既保持了系统的一致性，又提供了租户之间的隔离性和定制性。同时，通过恰当处理导入导出过程中的ID变化，可以确保菜单配置在不同租户间正常工作。
