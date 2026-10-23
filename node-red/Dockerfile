ARG NODE_RED_IMAGE=nodered/node-red:latest
FROM ${NODE_RED_IMAGE}

# 预装插件，避免每次部署后在 Palette 中手动安装。
# 安装在应用目录，避免持久化挂载 /data 时遮盖插件。
WORKDIR /usr/src/node-red
RUN npm install --omit=dev --no-audit --no-fund \
        @flowfuse/node-red-dashboard \
        node-red-contrib-mongodb4@3.4.0 \
        adm-zip@0.6.1 \
    && npm cache clean --force

ENV TZ=Asia/Shanghai

# 沿用官方镜像的非 root 用户、入口命令和健康检查。
# MongoDB 服务由 Compose 中的独立容器提供。
