export async function resolve(specifier, context, nextResolve) {
    if (specifier === "@minecraft/server") {
        return { url: new URL("./minecraft-server-encounter-mock.js", import.meta.url).href, shortCircuit: true };
    }
    return nextResolve(specifier, context);
}
