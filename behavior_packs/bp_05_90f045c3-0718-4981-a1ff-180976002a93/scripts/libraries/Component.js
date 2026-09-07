export class Component {
    id;
    event;
    defaults;
    subscriptions = {};
    constructor(id, event, defaults = {}) {
        this.id = id;
        this.event = event;
        this.defaults = defaults;
    }
    subscribe(cb) {
        const id = Date.now() * Math.random();
        this.subscriptions[id] = cb;
        return id;
    }
    unsubscribe(id) {
        delete this.subscriptions[id];
    }
    run(data, params) {
        for (const cb of Object.values(this.subscriptions)) {
            cb(data, params);
        }
    }
    getParamsFrom(item) {
        const component = item.getComponent(this.id);
        return component ? component.customComponentParameters.params : null;
    }
}
