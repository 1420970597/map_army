# 分享服务只使用 Node.js 标准库，文档写入独立持久卷。
FROM node:22-alpine
WORKDIR /app
COPY server/index.mjs ./index.mjs
RUN mkdir -p /data/shares && chown -R node:node /data
USER node
ENV SHARE_DIRECTORY=/data/shares
EXPOSE 3001
CMD ["node", "index.mjs"]
