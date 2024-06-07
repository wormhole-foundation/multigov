all: build

#######################
## BUILD

.PHONY: build
build-evm:
	cd evm && forge build

.PHONY: clean-evm
clean-evm:
	cd evm && forge clean

.PHONY: install-evm
install-evm:
	cd evm && forge install

#######################
## TESTS

.PHONY: check-format
check-format:
	cd evm && scopelint check

.PHONY: fix-format
fix-format:
	cd evm && scopelint fmt

.PHONY: test
test-evm:
	cd evm && forge test -vvv

