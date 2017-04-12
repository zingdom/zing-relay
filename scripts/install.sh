#!/usr/bin/env bash

BOLD='\033[0;1m' 
NC='\033[0m' # No Color

set -e
trap times EXIT

{ # this ensures the entire script is downloaded #

echo '    _____  _'
echo '   |__  / (_)  _ __     __ _'
echo '     / /  | | | '"'"'_ \   / _` |'
echo '    / /_  | | | | | | | (_| |'
echo '   /____| |_| |_| |_|  \__, |'
echo '                       |___/  installer.sh (1.2.5)'
echo

RELAY_NAME=
while [[ $RELAY_NAME = "" ]]; do
	printf "? ${BOLD}Name of this Relay${NC} (e.g. 'Living Rm'): "
	read -r RELAY_NAME < /dev/tty
	RELAY_NAME="$(echo -e "${RELAY_NAME}" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"

	if [ "$RELAY_NAME" = "" ]; then
		printf ">>> ERROR: ${BOLD}relay name cannot be empty${NC}\n\n"
	fi
done

SITE_TOKEN=
while [[ $SITE_TOKEN = "" ]]; do
	printf "? ${BOLD}Site Token${NC} (copy from Zing dashboard): "
	read -r SITE_TOKEN < /dev/tty
	SITE_TOKEN="$(echo -e "${SITE_TOKEN}" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"

	if [ "$SITE_TOKEN" = "" ]; then
		printf ">>> ERROR: ${BOLD}site token cannot be empty${NC}\n\n"
	elif [ $(echo -ne "${SITE_TOKEN}" | wc -m) -ne 24 ]; then
		printf ">>> ERROR: ${BOLD}site token looks weird${NC}\n\n"
		SITE_TOKEN=
	fi
done

if [[ $(id -u) -ne 0 ]] ; then echo "Please run as root" ; echo ; exit 1 ; fi

echomsg() { echo; echo "[INSTALLER] # $@" ; }
echoexec() { echo ; echo "[INSTALLER] \$ $@" ; "$@" ; }

zing_do_install() {
	local __TMP_DIR="/tmp/zing.install"
	local __BLUEZ_VERSION="5.44"
	local __NVM_VERSION="0.33.1"
	local __BLUETOOTH_CFG="/etc/systemd/system/bluetooth.target.wants/bluetooth.service"

	echoexec apt update
	echoexec apt full-upgrade -y

	# install dependencies for the bluetooth driver
	echoexec apt install -y libusb-dev \
							libdbus-1-dev \
							libglib2.0-dev \
							libudev-dev \
							libical-dev \
							libreadline-dev

	# download and build bluez
	echoexec mkdir -p "${__TMP_DIR}"
	echoexec wget -O "${__TMP_DIR}/bluez-${__BLUEZ_VERSION}.tar.xz" http://www.kernel.org/pub/linux/bluetooth/bluez-${__BLUEZ_VERSION}.tar.xz
	echoexec cd "${__TMP_DIR}"
	echoexec tar xvf bluez-${__BLUEZ_VERSION}.tar.xz
	echoexec cd bluez-${__BLUEZ_VERSION}
	echoexec ./configure --enable-deprecated
	echoexec make
	echoexec make install

	# setup/overwrite existing systemd unit
	echoexec systemctl stop bluetooth
	echoexec cp /usr/local/libexec/bluetooth/bluetoothd /usr/lib/bluetooth/
	echoexec cp /usr/local/libexec/bluetooth/obexd /usr/lib/bluetooth/

	# add --experimental flag to enable BLE
	if grep -xq "ExecStart=.*\/bluetoothd\s*\-\-experimental" "$__BLUETOOTH_CFG"
	then
		echomsg "bluetoothd already using '--experimental' flag"
	else
		echoexec sed -i '/^ExecStart=.*\/bluetoothd\s*$/ s/$/ --experimental/' "$__BLUETOOTH_CFG" \
				|| exit -1
	fi

	echoexec systemctl daemon-reload
	echoexec systemctl start bluetooth

	# done with root stuff, continue as the calling user, presuambly 'pi'
	echomsg "continuing installation as '${SUDO_USER}'"

su ${SUDO_USER} <<'EOF_EOF_EOF'
	set -e

	echomsg() { echo; echo "[installer] # $@" ; }

	echomsg "installing nvm..."
	wget -qO- https://raw.githubusercontent.com/creationix/nvm/v0.33.1/install.sh | bash
	export NVM_DIR="$HOME/.nvm"
	[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm

	echomsg "installing Node.js..."
	nvm install --lts node

	echomsg "give Node.js permission to access bluetooth..."
	sudo setcap cap_net_raw+eip $(eval readlink -f `which node`)

	echomsg "installing yarn..."
	npm install -g yarn

	echomsg "installing zing-relay..."
	yarn global add zing-relay

	echomsg "creating starting script for zing-relay..."
	mkdir -p ~/.zing-relay
	echo '#!/bin/bash' > ~/.zing-relay/start.sh
	echo ". ${HOME}/.nvm/nvm.sh" >> ~/.zing-relay/start.sh

EOF_EOF_EOF

	local __ZING_RELAY_SERVICE="/etc/systemd/system/zing-relay.service"
	echomsg "creating systemd service..."
	echo "[Unit]" 											> "$__ZING_RELAY_SERVICE"
	echo "Description=Zing Relay"							>> "$__ZING_RELAY_SERVICE"
	echo 													>> "$__ZING_RELAY_SERVICE"
	echo "[Service]" 										>> "$__ZING_RELAY_SERVICE"
	echo "ExecStart=/home/${SUDO_USER}/start-zing-relay.sh"	>> "$__ZING_RELAY_SERVICE"
	echo "WorkingDirectory=/home/${SUDO_USER}"				>> "$__ZING_RELAY_SERVICE"
	echo "IgnoreSIGPIPE=false"								>> "$__ZING_RELAY_SERVICE"
	echo "KillMode=control-group"							>> "$__ZING_RELAY_SERVICE"
	echo "User=${SUDO_USER}"								>> "$__ZING_RELAY_SERVICE"
	echo 													>> "$__ZING_RELAY_SERVICE"
	echo "[Install]"										>> "$__ZING_RELAY_SERVICE"
	echo "WantedBy=multi-user.target"						>> "$__ZING_RELAY_SERVICE"

	echo "zing-relay --token \"${SITE_TOKEN}\" --name \"${RELAY_NAME}\"" >> /home/${SUDO_USER}/.zing-relay/start.sh

	echomsg "done, reboot to complete the installation"
	echo
}

[ "_$ZING_ENV" = "_testing" ] || zing_do_install

} # this ensures the entire script is downloaded #
