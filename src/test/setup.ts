import '@testing-library/jest-dom/vitest'

// jsdom doesn't implement <dialog>'s showModal()/close() (throws
// "not implemented"). Every modal in this app (purchasing's Dialog, admin's
// EntityDialog, accounting's Dialog) wraps the native element directly, so
// polyfill the two methods once here rather than per test file.
if (typeof HTMLDialogElement !== 'undefined') {
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
      this.setAttribute('open', '')
    }
  }
  if (!HTMLDialogElement.prototype.close) {
    HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
      this.removeAttribute('open')
      this.dispatchEvent(new Event('close'))
    }
  }
}
