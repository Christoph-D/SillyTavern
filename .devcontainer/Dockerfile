FROM mcr.microsoft.com/playwright:v1.58.2-noble

RUN apt-get update && apt-get -y install tini git git-lfs curl bash ripgrep jq less

RUN ln -sf /usr/share/zoneinfo/hostlocaltime /etc/localtime

USER ubuntu
WORKDIR /home/ubuntu

RUN mkdir -p /home/ubuntu/persistent-config
RUN SNIPPET="export PROMPT_COMMAND='history -a' && export HISTFILE=/home/ubuntu/persistent-config/.bash_history" \
  && echo "$SNIPPET" >> "/home/ubuntu/.bashrc"

WORKDIR /workspaces/sillytavern

EXPOSE 8000
