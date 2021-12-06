import App from "./App.svelte";

const now = new Date().toLocaleString();
const app = new App({
	target: document.body,
	props: {},
});

export default app;
