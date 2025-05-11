我是小白
我要在一台rocky9.5服务器上 从源码部署一个项目
服务器地址：1922.168.2.108
仓库： https://github.com/allenye199/thingsboard.git
项目官方网站：thingsboard.io
数据库要求：postgres 16.8
我主要是进行前端的修改和开发，因此前端开发服务器要可用，后端服务的代理也要有
整个过程尽量详细，浅显。

============================================================================================
数据库名：	thingsboard
用户名：		postgres 
用户密码: 	postgres



============================================================================================
以下是从源码部署 ThingsBoard 项目并配置前端开发环境的详细步骤，适合小白用户。请按照步骤操作：

-------------------------------------------------

### **1. 准备服务器环境**
确保您的 Rocky Linux 9.5 服务器已启动并可以通过 SSH 访问。

#### **1.1 更新系统**
使用以下命令更新系统软件包：
```bash
sudo dnf update -y
```

#### **1.2 安装必要的软件**
安装 Git、Java 17（ThingsBoard 需要）、Node.js（前端开发需要）和其他工具：
```bash
sudo dnf install -y git wget curl unzip tar gcc-c++ make
```

安装 OpenJDK 17：
```bash
sudo dnf install -y java-17-openjdk java-17-openjdk-devel
```

安装 Node.js 18（ThingsBoard 前端推荐版本）：
```bash
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo dnf install -y nodejs
```

验证安装：
```bash
java -version
node -v
npm -v
```

---

### **2. 安装 PostgreSQL 数据库**
ThingsBoard 需要 PostgreSQL 作为数据库。

#### **2.1 添加 PostgreSQL 16 仓库**
```bash
sudo dnf install -y https://download.postgresql.org/pub/repos/yum/16/redhat/rhel-9-x86_64/pgdg-redhat-repo-latest.noarch.rpm
sudo dnf install -y postgresql16 postgresql16-server postgresql16-contrib
```

#### **2.2 初始化数据库**
```bash
sudo /usr/pgsql-16/bin/postgresql-16-setup initdb
sudo systemctl enable postgresql-16
sudo systemctl start postgresql-16
```

#### **2.3 配置数据库用户和数据库**
切换到 PostgreSQL 用户并创建数据库和用户：
```bash
sudo -i -u postgres
psql
```

在 PostgreSQL 控制台中运行以下命令,创建数据库和用户密码：
```sql
CREATE DATABASE thingsboard;
CREATE USER postgres WITH PASSWORD 'postgres';
GRANT ALL PRIVILEGES ON DATABASE thingsboard TO postgres;
\q
exit
```

创建表和数据
```
cd ${TB_WORK_DIR}/application/target/bin/install
chmod +x install_dev_db.sh
./install_dev_db.sh
```


---

### **3. 克隆 ThingsBoard 源码**
切换到您的工作目录并克隆仓库：
```bash
git clone https://github.com/allenye199/thingsboard.git
cd thingsboard
```

---

### **4. 构建后端**
ThingsBoard 使用 Maven 构建后端。

#### **4.1 安装 Maven**
```bash
sudo dnf install -y maven
```

#### **4.2 构建后端**
在项目根目录运行：
```bash
mvn clean install -DskipTests
```

---

### **5. 配置和运行后端服务**
#### **5.1 配置 ThingsBoard**
编辑 `thingsboard.yml` 文件，配置数据库连接：
```yaml
spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/thingsboard
    username: postgres
    password: postgres
```

#### **5.2 启动后端服务**
运行以下命令启动后端服务：
```bash
java -jar application/target/thingsboard-4.0.1-boot.jar

```

---

### **6. 构建和运行前端**
#### **6.1 切换到前端目录**
```bash
cd ui-ngx
```

#### **6.2 安装依赖**
```bash
npm install
```
#### **6.2 编译**

npm run build

#### **6.3 启动前端开发服务器**
```bash
npm start
```

前端开发服务器默认运行在 `http://localhost:4200`。

---

### **7. 配置代理**
为了让前端与后端通信，您需要配置代理。

#### **7.1 编辑代理配置**
在 `ui-ngx/proxy.conf.js` 中配置后端代理：
```

  "/custom-api": { // 新增的代理配置
    "target": forwardUrl,
    "secure": false,
    "changeOrigin": true
  }

```

确保前端开发服务器可以代理到后端服务。

---

### **8. 访问和开发**
- 前端开发服务器地址：`http://192.168.2.108:4200`
- 后端服务地址：`http://192.168.2.108:8080`

您可以开始修改前端代码，保存后会自动刷新页面。

---

### **9. 常见问题**
- 如果端口被防火墙阻止，请开放端口：
```bash
sudo firewall-cmd --add-port=4200/tcp --permanent
sudo firewall-cmd --add-port=8080/tcp --permanent
sudo firewall-cmd --reload
```

- 如果需要调试后端日志，请查看：
```bash
tail -f logs/thingsboard.log
```

---

完成以上步骤后，您应该可以成功部署 ThingsBoard 并开始前端开发。如果有任何问题，请随时提问！

====================================================================================
