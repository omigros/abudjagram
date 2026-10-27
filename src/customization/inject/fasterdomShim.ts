// Stands in for Fasterdom when the customization runs inside the official Telegram Web, where the app's own
// scheduler (and its error handling and multitab wiring) must not be loaded a second time
export function requestMutation(cb: NoneToVoidFunction) {
  requestAnimationFrame(cb);
}
