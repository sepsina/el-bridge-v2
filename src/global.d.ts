import {
    ElectronUSB,
    ElectronUDP,
    ElectronItemStore,
    ElectronStatStore
} from '../electron/preload';

declare global {
  interface Window {
    electronUSB: ElectronUSB;
    electronUDP: ElectronUDP;
    electronItemStore: ElectronItemStore;
    electronStatStore: ElectronStatStore;
  }
}
