load('ext://namespace', 'namespace_create', 'namespace_inject')
load('ext://git_resource', 'git_checkout')

# Add platform settings for M3 Mac
def get_architecture():
    arch = str(local('uname -m', quiet=True))
    return '--platform=linux/arm64' if 'arm64' in arch else ''

git_checkout('https://github.com/wormhole-foundation/wormhole.git#main', '.wormhole/', unsafe_mode=True)
load(".wormhole/Tiltfile", "namespace", "k8s_yaml_with_ns")

# CI tests (includes EVM contracts in build)
custom_build(
    ref = "multi-gov-ci",
    command = 'DOCKER_BUILDKIT=1 docker build --network=host %s --progress=plain --build-arg BUILDKIT_INLINE_CACHE=1 -t $EXPECTED_REF -f ./integration-tests/Dockerfile .' % get_architecture(),
    deps = ['./integration-tests', './evm'],
    ignore=['node_modules', '.wormhole', 'cache', 'out']
)

k8s_yaml_with_ns("./integration-tests/ci.yaml") 
k8s_resource(
    "multi-gov-tests",
    labels = ["multi-gov"],
    resource_deps = ["eth-devnet", "eth-devnet2", "query-server"],
)
