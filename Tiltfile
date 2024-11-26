load('ext://namespace', 'namespace_create', 'namespace_inject')
load('ext://git_resource', 'git_checkout')

git_checkout('https://github.com/wormhole-foundation/wormhole.git#main', '.wormhole/', unsafe_mode=True)
# local(['sed','-i','/{chainId: vaa.ChainIDEthereum, addr: "000000000000000000000000855FA758c77D68a04990E992aA4dcdeF899F654A"},/i {chainId: vaa.ChainIDSolana, addr: "8bf0b547c96edc5c1d512ca25c5c1d1812a180438a0046e511d1fb61561d5cdf"},{chainId: vaa.ChainIDSolana, addr: "0a490691c21334ca173d9ce386e2a86774ce173f351db10d5d0cccc5c4875376"},{chainId: vaa.ChainIDEthereum, addr: "0000000000000000000000006f84742680311cef5ba42bc10a71a4708b4561d1"},{chainId: vaa.ChainIDEthereum, addr: "000000000000000000000000c3ef4965b788cc4b905084d01f2eb7d4b6e93abf"},{chainId: vaa.ChainIDBSC, addr: "0000000000000000000000006f84742680311cef5ba42bc10a71a4708b4561d1"},{chainId: vaa.ChainIDBSC, addr: "0000000000000000000000003f4e941ef5071a1d09c2eb4a24da1fc43f76fcff"},', '.wormhole/node/pkg/accountant/ntt_config.go'])

load(".wormhole/Tiltfile", "namespace", "k8s_yaml_with_ns")

# Copied from .wormhole/Tiltfile, as this setup will extend the `solana-contract` image in order to inject the .so at startup
docker_build(
    ref = "bridge-client",
    context = ".wormhole/",
    only = ["./proto", "./solana", "./clients"],
    dockerfile = ".wormhole/solana/Dockerfile.client",
    # Ignore target folders from local (non-container) development.
    ignore = [".wormhole/solana/*/target"],
)
docker_build(
    ref = "solana-contract",
    context = ".wormhole/solana",
    dockerfile = ".wormhole/solana/Dockerfile",
    target = "builder",
    build_args = {"BRIDGE_ADDRESS": "Bridge1p5gheXUvJ6jGWGeCsgPKgnE3YgdGKRVCMY9o"}
)

# EVM build
docker_build(
    ref = "multi-gov-evm-contract",
    context = "./evm",
    dockerfile = "./evm/Dockerfile",
)

# CI tests
docker_build(
    ref = "multi-gov-ci",
    context = "./integration-tests",
    dockerfile = "./integration-tests/Dockerfile",
)
k8s_yaml_with_ns("./integration-tests/ci.yaml") 
k8s_resource(
    "multi-gov-tests",
    labels = ["multi-gov"],
    resource_deps = ["eth-devnet", "eth-devnet2", "solana-devnet", "guardian", "relayer-engine", "wormchain"],
)
