# Sử dụng image Node.js từ Docker Hub
FROM node:16

# Cài đặt các dependencies cho canvas (nếu cần)
RUN apt-get update && apt-get install -y \
    libcairo2-dev \
    libjpeg-dev \
    libpango1.0-dev \
    libgif-dev \
    build-essential \
    g++

# Thiết lập thư mục làm việc trong container
WORKDIR /app

# Copy mã nguồn vào container
COPY . /app

# Cài đặt các dependencies của dự án
RUN npm install

# Chạy ứng dụng
CMD ["npm", "start"]

# Mở cổng ứng dụng (thường là 3000 hoặc cổng khác bạn sử dụng)
EXPOSE 3000
