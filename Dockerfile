FROM consol/ubuntu-xfce-vnc
ENV REFRESHED_AT 2018-03-18
USER 0
RUN apt-get update
RUN apt-get install -y curl wget make g++
RUN curl -fsSL https://deb.nodesource.com/setup_lts.x | bash -
RUN apt-get install -y nodejs
RUN npm i -g yarn
WORKDIR /headless/app
COPY . .
RUN yarn
USER 1000
