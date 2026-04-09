class PotatoContext {
    count = $state(0);

    increment() {
        this.count++;
    }

    decrement() {
        if (this.count > 0) this.count--;
    }
}

export const potatoContext = new PotatoContext();
