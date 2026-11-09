import {
    AfterViewInit,
    Component,
    ElementRef,
    HostListener,
    OnInit,
    OnDestroy,
    viewChild,
    inject,
    signal,
    effect,
    computed
} from '@angular/core';
import { DragDropModule, CdkDragEnd, CdkDragStart } from "@angular/cdk/drag-drop";
import { HttpClient, HttpErrorResponse, httpResource } from '@angular/common/http';
import { ResizeObserverDirective } from './directives/resize-observer.directive';
import { Dialog, DialogModule } from '@angular/cdk/dialog';
import { OverlayModule } from '@angular/cdk/overlay';

import { CommonModule } from '@angular/common';

import { StorageService } from './services/storage.service';
import { UtilsService } from './services/utils.service';
import { UsbService } from './services/usb.service';

import * as gConst from './gConst';
import * as gIF from './gIF';

import { ItemStylePipe } from './pipes/item-style.pipe';
import { ItemPositionPipe } from './pipes/item-position.pipe';

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [
        CommonModule,
        DragDropModule,
        ResizeObserverDirective,
        DialogModule,
        OverlayModule,
        ItemStylePipe,
        ItemPositionPipe
    ],
    templateUrl: 'app.component.html',
    styleUrls: ['app.component.scss'],
    host: {
        '(window:beforeunload)': 'closeComms()'
    }
})
export class AppComponent implements OnInit, AfterViewInit, OnDestroy {

    containerRef = viewChild.required('containerRef', {read: ElementRef});
    floorPlanRef = viewChild.required('floorPlanRef', {read: ElementRef});

    imgWidth = signal<number>(0);
    bkgImgWidth = signal<number>(1920);
    bkgImgHeight = signal<number>(1080);
    bkgImgUrl = signal<string>('');

    imgDim = computed(() => {
        const width = this.imgWidth();
        const bkgW = this.bkgImgWidth();
        const bkgH = this.bkgImgHeight();
        const height = bkgW > 0 ? Math.round((width / bkgW) * bkgH) : 0;
        return { width, height };
    });

    partMap = new Map<number, gIF.part_t>();
    isDraggingEnabled = signal<boolean>(false);

    selectedItemState = signal<{
        selectedItem: gIF.keyVal_t | null;
        showCtrl: boolean;
        showCorr: boolean;
        showBattery: boolean;
        showGraph: boolean;
    }>({
        selectedItem: null,
        showCtrl: false,
        showCorr: false,
        showBattery: false,
        showGraph: false
    });


    trash = 0;

    footerTmo: ReturnType<typeof setTimeout> | null = null;
    footerStatus = signal('');

    strIdx = 0;
    usbStatus = signal('usb not connected');

    private removeUsbListener?: () => void;

    itemsList = computed(() => {
        const map = this.storage.itemMap();
        return Array.from(map.entries()).map(([key, value]) => ({ key, value }));
    });

    private partsResource = httpResource<gIF.partDesc_t[]>(() => './assets/parts.json');
    private partsSyncEffect = effect(() => {
        const parts = this.partsResource.value();
        if(parts) {
            this.partMap.clear();
            for(const desc of parts) {
                this.partMap.set(desc.partNum, {
                    devName: desc.devName,
                    part: desc.part,
                    url: desc.url
                });
            }
        }
        if(this.partsResource.error()) {
            console.error('Parts catalog resource fetch failed:', this.partsResource.error());
        }
    });

    t_event = effect(()=>{
        const t = this.storage.tempEvent();
        setTimeout(()=>{
            this.tempEvent(t);
        }, 0);
    });

    pb_event = effect(()=>{
        const trig = this.storage.pbEvent();
        setTimeout(()=>{
            this.pbEvent(trig);
        }, 0);
    });

    storage = inject(StorageService);
    httpClient = inject(HttpClient);
    utils = inject(UtilsService);
    usb = inject(UsbService);
    dialog = inject(Dialog);

    constructor() {
        // ---
    }

    /***********************************************************************************************
     * fn          onUsbConnectClick
     *
     * brief
     *
     */
    async onUsbReqDev(): Promise<void> {
        await this.usb.requestDevice();
    }

    /***********************************************************************************************
     * fn          ngAfterViewInit
     *
     * brief
     *
     */
    ngAfterViewInit() {
        /*
        try {
            window.resizeTo(window.screen.availWidth, window.screen.availHeight);
            window.resizeBy(-100, -100);
            window.moveTo(50, 50);
        } catch(e) {
            console.log(e);
        }
        */

        setTimeout(() => {
            this.init();
        }, 10);

        setTimeout(() => {
            this.capitalizeAtIndex();
        }, 500);
    }

    /***********************************************************************************************
     * fn          ngOnInit
     *
     * brief
     *
     */
    ngOnInit() {

        this.removeUsbListener = window.electronUSB.onUsbDevicesAvailable((devices) => {
            this.getUSB(devices);
        });

        setTimeout(() => {
            this.usb.initApp();
        }, 100);
    }

    /***********************************************************************************************
     * fn          ngOnDestroy
     *
     * brief
     *
     */
    ngOnDestroy() {
        if(this.removeUsbListener){
            this.removeUsbListener();
        }
        window.electronUDP.close('ng-on-destroy');
        // ---
    }

    /***********************************************************************************************
     * fn          closeComms
     *
     * brief
     *
     */
    closeComms(){
        this.usb.closeDevice();
    };

    /***********************************************************************************************
     * fn          init
     *
     * brief
     *
     */
    init() {

        const bkgImgPath = './assets/floor_plan.jpg';
        const bkgImg = new Image();
        bkgImg.onload = ()=>{
            this.bkgImgWidth.set(bkgImg.width);
            this.bkgImgHeight.set(bkgImg.height);
            this.bkgImgUrl.set(`url(${bkgImgPath})`);

            const el = this.floorPlanRef().nativeElement;
            const divDim = el.getBoundingClientRect();
            this.imgWidth.set(divDim.width);
        };
        bkgImg.src = bkgImgPath;

        /*
        const scrolls = this.storage.getScrolls();
        if(scrolls){
            const nvScrolls = JSON.parse(this.storage.getScrolls());
            if(nvScrolls){
                this.storage.scrolls.set(nvScrolls);
            }
        }
        */
    }


    /***********************************************************************************************
     * @fn          onDragEnded
     *
     * @brief
     *
     */
    onDragEnded(event: CdkDragEnd, keyVal: gIF.keyVal_t) {

        const { width, height } = this.imgDim();
        if (width === 0 || height === 0) return;

        const evtPos = event.source.getFreeDragPosition();
        const pos: gIF.nsPos_t = {
            x: evtPos.x / width,
            y: evtPos.y / height,
        };

        this.storage.setItemPos(pos, keyVal);
    }

    /***********************************************************************************************
     * @fn          onDragStarted
     *
     * @brief
     *
     */
    onDragStarted(event: CdkDragStart, keyVal: gIF.keyVal_t) {

        keyVal.value.drag = true;
    }

    /***********************************************************************************************
     * @fn          setStyles
     *
     * @brief
     *
     */
    async setStyles() {

        const currentSelection = this.selectedItemState().selectedItem;
        if (!currentSelection) {
            console.warn('Style dialog abort: No item layout configuration actively selected.');
            return;
        }

        const { SetStyles } = await import('./set-styles/set-styles');
        const dlgRef = this.dialog.open(SetStyles, {
            data: {
            keyVal: currentSelection // Cleanly forward the verified dataset bundle
            },
            restoreFocus: false
        });

        dlgRef.closed.subscribe((style: any) => {
            if (style) {
                this.storage.setItemStyle(style, currentSelection);
            }
        });
    }

    /***********************************************************************************************
     * @fn          setName
     *
     * @brief
     *
     */

    async setName() {

        const currentSelection = this.selectedItemState().selectedItem;

        if (!currentSelection) {
            console.warn('Name dialog abort: No item layout configuration actively selected.');
            return;
        }

        const { SetName } = await import('./set-name/set-name');
        const dlgRef = this.dialog.open(SetName, {
            data: {
                keyVal: currentSelection
            },
            restoreFocus: false
        });

        dlgRef.closed.subscribe((data: any) => {
            if (data) {
                this.storage.setItemName(data, currentSelection);
            }
        });
    }

    /***********************************************************************************************
     * @fn          setCorr
     *
     * @brief
     *
     */
    async setCorr() {

        const currentSelection = this.selectedItemState().selectedItem;
        if (!currentSelection) {
            console.warn('Correction dialog abort: No item layout configuration actively selected.');
            return;
        }

        const { SetCorr } = await import('./set-corr/set-corr');
        const dlgRef = this.dialog.open<gIF.valCorr_t>(SetCorr, {
            restoreFocus: false,
            data: {
                keyVal: currentSelection
            }
        });

        dlgRef.closed.subscribe((valCorr) => {
            if(valCorr) {
                this.storage.setItemCorr(valCorr, currentSelection);
            }
        });
    }

    /***********************************************************************************************
     * @fn          graph
     *
     * @brief
     *
     */
    async graph() {

        const currentSelection = this.selectedItemState().selectedItem;
        if (!currentSelection) {
            console.warn('Graph dialog abort: No item layout configuration actively selected.');
            return;
        }

        const { Graph } = await import('./chart/chart');
        const dlgRef = this.dialog.open(Graph, {
            data: {
                keyVal: currentSelection
            },
            restoreFocus: false
        });

        dlgRef.closed.subscribe((data) => {
            console.log(`graph dlg data: ${data}`);
        });
    }

    /***********************************************************************************************
     * @fn          getUSB
     *
     * @brief
     *
     */
    async getUSB(devs: Electron.USBDevice[]) {

        await this.usb.closeDevice();

        const { SelUSB } = await import('./sel-usb/sel-usb');
        const dlgRef = this.dialog.open(SelUSB, {
            data: {
                devices: devs,
            },
            restoreFocus: false,

        });
        dlgRef.closed.subscribe((data: any)=>{
            console.log(`sel-usb dlg data: ${data}`);
            if(data != undefined) {
                window.electronUSB.selectUsbDevice(data as string);
            }
            else {
                window.electronUSB.cancelUsbDevice();
            }
        });
    }

    /***********************************************************************************************
     * @fn          editScrolls
     *
     * @brief
     *
     *
    async editScrolls() {

        const { EditScrolls } = await import('./edit-scrolls/edit-scrolls');
        const dlgRef = this.dialog.open(EditScrolls, {
            data: {
                containerRef: this.containerRef().nativeElement,
                imgDim: this.imgDim,
            },
            restoreFocus: false,

        });
        dlgRef.closed.subscribe((data)=>{
            console.log(`scrolls dlg data: ${data}`);
        });
    }
    */
    /***********************************************************************************************
     * @fn          editThermostats
     *
     * @brief
     *
     */
    async editThermostats() {

        const { EditStats } = await import('./x-stat/x-stat');
        const dlgRef = this.dialog.open(EditStats, {
            data: {
                partsMap: this.partMap
            },
            restoreFocus: false,
        });
        dlgRef.closed.subscribe((data)=>{
            console.log(`stats dlg data: ${data}`);
        });
    }

    /***********************************************************************************************
     * @fn          showLogs
     *
     * @brief
     *
     */
    async showLogs() {

        const { ShowLogs } = await import('./logs/show-logs');
        const dlgRef = this.dialog.open(ShowLogs, {
            restoreFocus: false,
        });
        dlgRef.closed.subscribe((data)=>{
            console.log(`logs dlg data: ${data}`);
        });
    }

    /***********************************************************************************************
     * @fn          showAbout
     *
     * @brief
     *
     */
    async showAbout() {

        const currentSelection = this.selectedItemState().selectedItem;
        if (!currentSelection) {
            console.warn('About dialog abort: No item layout configuration actively selected.');
            return;
        }

        const { About } = await import('./about/about');
        const dlgRef = this.dialog.open(About, {
            data: {
                item: currentSelection.value, // Preserves passing the underlying value structure
                partsMap: this.partMap
            },
            restoreFocus: false
        });

        dlgRef.closed.subscribe((data) => {
            console.log(`about dlg data: ${data}`);
        });
    }

    /***********************************************************************************************
     * @fn          showBattery
     *
     * @brief
     *
     */
    async showBattery() {

        const currentSelection = this.selectedItemState().selectedItem;
        if (!currentSelection) {
            console.warn('Battery dialog abort: No item layout configuration actively selected.');
            return;
        }

        const { Battery } = await import('./battery/battery');
        const dlgRef = this.dialog.open(Battery, {
            data: {
                item: currentSelection.value,
                partsMap: this.partMap
            },
            restoreFocus: false
        });

        dlgRef.closed.subscribe((data) => {
            console.log(`battery dlg data: ${data}`);
        });
    }

    /***********************************************************************************************
     * @fn          showSSR
     *
     * @brief
     *
     */
    async showSSR() {

        const currentSelection = this.selectedItemState().selectedItem;
        if (!currentSelection) {
            console.warn('SSR dialog abort: No item layout configuration actively selected.');
            return;
        }

        const { SSR } = await import('./ssr/ssr');
        const dlgRef = this.dialog.open(SSR, {
            data: {
                item: currentSelection.value
            },
            restoreFocus: false
        });

        dlgRef.closed.subscribe((data) => {
            console.log(`ssr dlg data: ${data}`);
        });
    }

    /***********************************************************************************************
     * fn          onResize
     *
     * brief
     *
     */
    onResize(event: any) {

        const rect = event.contentRect;
        this.imgWidth.set(rect.width);
    }

        /***********************************************************************************************
     * fn          selectItemForEditing
     *
     * brief
     *
     */
    selectItemForEditing(keyVal: gIF.keyVal_t) {

        const item = keyVal.value;

        let showCtrl = false;
        let showCorr = false;
        let showBattery = false;

        switch (item.partNum) {
            case gConst.SSR_009:
                showCtrl = true;
                break;
            case gConst.SHT40_018:
                showBattery = true;
                showCorr = true;
                break;
            case gConst.PB_023:
                showBattery = true;
                break;
        }

        this.selectedItemState.set({
            selectedItem: keyVal,
            showCtrl,
            showCorr,
            showBattery,
            showGraph: (item.vals?.length ?? 0) > 1
        });
    }

    /***********************************************************************************************
     * fn          clearSelection
     *
     * brief
     *
     */
    clearSelection() {
        this.selectedItemState.set({
            selectedItem: null,
            showCtrl: false,
            showCorr: false,
            showBattery: false,
            showGraph: false
        });
    }

    /***********************************************************************************************
     * fn          mouseEnterAttr
     *
     */
    mouseEnterItem(keyVal: gIF.keyVal_t) {

        const item = keyVal.value;
        const partDesc: gIF.part_t = this.partMap.get(item.partNum) || { devName: 'unknown', part: 'unknown', url: '' };

        const status = `${item.name}: ${partDesc.part} -> ${partDesc.devName}`;
        this.footerStatus.set(status);

        if (this.footerTmo) clearTimeout(this.footerTmo);

        this.footerTmo = setTimeout(() => {
            this.footerStatus.set('');
        }, 5000);
    }

    /***********************************************************************************************
     * fn          mouseLeaveAttr
     *
     */
    mouseLeaveItem() {
        if (this.footerTmo) clearTimeout(this.footerTmo);
        this.footerStatus.set('');
    }

    /***********************************************************************************************
     * fn          tempEvent
     *
     * brief
     *
     */
    tempEvent(event: gIF.tempEvent_t){

        const key = this.storage.thermostatKey(event.addr, event.endPoint);
        const nvThermostat: gIF.thermostat_t = this.storage.nvThermostatsMap.get(key);
        if(nvThermostat){
            if(nvThermostat.actuators.length){
                let changed = false;
                if(nvThermostat.setPoint !== nvThermostat.prevSetPoint){
                    changed = true;
                    nvThermostat.prevSetPoint = nvThermostat.setPoint;
                    nvThermostat.workPoint = nvThermostat.setPoint - nvThermostat.hysteresis;
                }
                if(event.temp > nvThermostat.workPoint){
                    if(nvThermostat.workPoint > nvThermostat.setPoint){
                        changed = true;
                        nvThermostat.workPoint = nvThermostat.setPoint - nvThermostat.hysteresis;
                    }
                }
                if(event.temp < nvThermostat.workPoint){
                    if(nvThermostat.workPoint < nvThermostat.setPoint){
                        changed = true;
                        nvThermostat.workPoint = nvThermostat.setPoint + nvThermostat.hysteresis;
                    }
                }
                if(changed){
                    this.storage.storeThermostat(nvThermostat);
                }

                let cmd = 0x00; // OFF
                if(event.temp < nvThermostat.workPoint){
                    cmd = 0x01; // ON
                }

                for(const on_off of nvThermostat.actuators){
                    /*
                    const zclCmd = {} as gIF.udpZclReq_t;
                    zclCmd.ip = '';  // not used
                    zclCmd.port = 0; // not used
                    zclCmd.addr = on_off.addr;
                    zclCmd.endPoint = on_off.endPoint;
                    zclCmd.clusterID = gConst.CLUSTER_ID_GEN_ON_OFF;
                    zclCmd.hasRsp = 0;
                    zclCmd.cmdLen = 3;
                    zclCmd.cmd = [];
                    zclCmd.cmd[0] = 0x11; // cluster spec cmd, not manu spec, client to srv dir, disable dflt rsp
                    zclCmd.cmd[1] = 0x00; // seq num -> not used
                    zclCmd.cmd[2] = cmd;  // ON/OFF command

                    this.storage.zclCmd.set(zclCmd);
                    */
                }
            }
        }
    }

    /***********************************************************************************************
     * fn          pbEvent
     *
     * brief
     *
     */
    pbEvent(event: gIF.pbEvent_t){
        console.log(event);
    }

    /***********************************************************************************************
     * fn          disableRightClick
     *
     * brief
     *
     */
    disableRightClick(event: MouseEvent){
        event.preventDefault();
    }

    /***********************************************************************************************
     * fn          capitalizeAtIndex
     *
     * brief
     *
     */
    capitalizeAtIndex() {

        if(this.usb.valid_dev_flag() == false){
            const status = this.usbStatus().toLowerCase();
            let new_status = status;

            this.strIdx++;
            if(this.strIdx == status.length){
                this.strIdx = 0;
            }
            new_status  = status.substring(0, this.strIdx);
            new_status += status[this.strIdx].toUpperCase();
            new_status += status.substring(this.strIdx + 1);

            this.usbStatus.set(new_status);
        }
        setTimeout(() => {
            this.capitalizeAtIndex();
        }, 200);
    }

    /***********************************************************************************************
     * @fn          moveSelectedItem
     * @brief       Shared logic for moving the selected item via keyboard or touch buttons
     */
    moveSelectedItem(direction: 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown', fast = false) {

        const currentSelection = this.selectedItemState().selectedItem;

        if(!currentSelection || !this.isDraggingEnabled()) {
            return;
        }

        const latestKeyVal = this.itemsList().find(item => item.key === currentSelection.key);
        if(!latestKeyVal) {
            return;
        }

        const step = fast ? 0.01 : 0.002;
        const pos = latestKeyVal.value.pos || { x: 0, y: 0 };

        let newX = pos.x;
        let newY = pos.y;

        switch(direction) {
            case 'ArrowLeft':
                newX = Math.max(0, pos.x - step);
                break;
            case 'ArrowRight':
                newX = Math.min(1, pos.x + step);
                break;
            case 'ArrowUp':
                newY = Math.max(0, pos.y - step);
                break;
            case 'ArrowDown':
                newY = Math.min(1, pos.y + step);
                break;
        }

        const newPos: gIF.nsPos_t = { x: newX, y: newY };
        this.storage.setItemPos(newPos, latestKeyVal);

        /*
        this.selectedItemState.update(state => ({
            ...state,
            selectedItem: {
                ...latestKeyVal,
                value: {
                    ...latestKeyVal.value,
                    pos: newPos
                }
            }
        }));
        */
    }

    /***********************************************************************************************
     * @fn          onKeyDown
     * @brief       Keyboard listener wrapper
     */
    @HostListener('window:keydown', ['$event'])
    onKeyDown(event: KeyboardEvent) {
        const arrowKeys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
        if (!arrowKeys.includes(event.key)) {
            return;
        }
        event.preventDefault();
        this.moveSelectedItem(event.key as any, event.shiftKey);
    }

}


