import * as gIF from './gIF';
export const LE = true;
export const BE = false;
export const HEAD_LEN = 5;
export const LEN_IDX = 2;
export const CRC_IDX = 4;

export const SHORT_BAT_REPORT = 2;

export const DUMMY_SCROLL = '- scroll -';
export const HIST_LEN = 50;

export const DFLT_IMG_DIR = 'files';
export const DFLT_BKG_IMG = '../../assets/floor_plan.jpg';
export const DFLT_IMG_NAME = 'floor_plan';

export const USB_MSG_ITEM_REPORT = 0x01;
export const USB_MSG_EP_CMD = 0x02;
export const USB_MSG_LOG = 0x03;

export const SL_START_CHAR = 0x01;
export const SL_ESC_CHAR = 0x02;
export const SL_END_CHAR = 0x03;

export const SL_MSG_LOG = 0x8001;

export const SL_MSG_HOST_ANNCE = 0x0A01;
export const SL_MSG_READ_ATTR_SET = 0x0A02;
export const SL_MSG_WRITE_ATTR_SET = 0x0A03;
export const SL_MSG_READ_ATTR_SET_AT_IDX = 0x0A04;
export const SL_MSG_READ_BIND = 0x0A05;
export const SL_MSG_WRITE_BIND = 0x0A06;
export const SL_MSG_READ_BIND_AT_IDX = 0x0A07;
export const SL_MSG_HOST_ERROR = 0x0A08;
export const SL_MSG_TESTPORT = 0x0A09;
export const SL_MSG_ZCL_CMD = 0x0A0A;
export const SL_MSG_ZDP_CMD = 0x0A0B;
export const SL_MSG_ZDO_CMD = 0x0A0C;
export const SL_MSG_USB_CMD = 0x0A0D;

export const SL_CMD_OK = 0;
export const SL_CMD_FAIL = 1;

export const MANU_NAME_LEN = 12;
export const MODEL_ID_LEN = 12;
export const DATE_CODE_LEN = 8;

export const CLUSTER_ID_GEN_BASIC = 0x0000;
export const CLUSTER_ID_POWER_CFG = 0x0001;
export const CLUSTER_ID_GEN_ON_OFF = 0x0006;
export const CLUSTER_ID_LEVEL_CTRL = 0x0008;
export const CLUSTER_ID_MS_TEMPERATURE_MEASUREMENT = 0x0402;
export const CLUSTER_ID_MS_PRESSURE_MEASUREMENT = 0x0403;
export const CLUSTER_ID_MS_RH_MEASUREMENT = 0x0405;
export const CLUSTER_ID_MS_AIR_QUALITY_CLUSTER_ID = 0x042E;

export const RD_HOST_RETRY_CNT = 3;

export const HOSTED_BINDS_TTL = 3; // minutes
export const ATTR_SET_TTL = 3; // minutes

export const RD_HOST_TMO = 300;
export const REQ_TMO = 50;

export const HOPS_MAX = 8;
export const INVALID_ADDR = 0xFE;

export const ZB_BRIDGE = 1;

export const HTU21D_005_BASE = 500;
export const HTU21D_005_T = 501;
export const HTU21D_005_RH = 502;
export const HTU21D_005_BAT = 503;

export const ENS_015_BASE = 1500;
export const ENS_015_AQ = 1501;

export const SHT40_018 = 1800;
export const SHT40_018_T = 1801;
export const SHT40_018_RH = 1802;
export const SHT40_018_BAT = 1803;

export const SI7021_027_BASE = 2700;
export const SI7021_027_T = 2701;
export const SI7021_027_RH = 2702;
export const SI7021_027_BAT = 2703;

export const SH_006_BASE = 600;
export const SH_006_SH = 601;
export const SH_006_BAT = 602;

export const DBL_SW_008_BASE = 800;
export const DBL_SW_008_PB_1 = 801;
export const DBL_SW_008_PB_2 = 802;
export const DBL_SW_008_BAT = 803;

export const TGL_SW_011_BASE = 1100;
export const TGL_SW_011_SW = 1101;
export const TGL_SW_011_BAT = 1102;

export const RKR_SW_012_BASE = 1200;
export const RKR_SW_012_SW = 1201;
export const RKR_SW_012_BAT = 1202;

export const PB_023 = 2300;
export const PB_023_SW = 2301;
export const PB_023_BAT = 2302;

export const SSR_009 = 900;
export const SSR_009_RELAY = 901;

export const ACTUATOR_010_BASE = 1000;
export const ACUATOR_010_ON_OFF = 1001;

//export const MAX_DST_BINDS = 4;
//export const MAX_SRC_BINDS = 14;

export const ATTR_TTL = 900; // seconds
export const ITEM_TTL = 900; // seconds
export const ATTR_VALID_TTL = 600; // seconds
export const ITEM_VALID_TTL = 600; // seconds
export const BIND_TTL = 900; // seconds
export const SET_TTL = 900; // seconds

export const BRIDGE_ID_REQ = 0x0001;
export const BRIDGE_ID_RSP = 0x0002;
export const ON_OFF_ACTUATORS = 0x0003;
export const UDP_ZCL_CMD = 0x0004;
export const T_SENSORS = 0x0005;
export const RH_SENSORS = 0x0006;
export const P_ATM_SENSORS = 0x0007;
export const BAT_VOLTS = 0x0008;
export const AQ_SENSORS = 0x0009;

export const NO_UNIT = 0;
export const DEG_C = 1;
export const DEG_F = 2;
export const RH_UNIT = 3;
export const VOLT_UNIT = 4;

//export const PUB_IP_KEY = 'public-ip';
//export const FREE_DNS_KEY = 'free-dns';
//export const SCROLLS_KEY = 'scrolls';

export const NG_STYLE = {
    color: '#000000',
    bgColor: '#ffffff',
    bgOpacity: 1.0,
    fontSize: 20,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: '#000000',
    borderRadius: 0,
    paddingTop: 4,
    paddingRight: 6,
    paddingBottom: 2,
    paddingLeft: 6
};

export const BORDER_STYLES = [
    "solid",
    "dashed",
    "dotted"
];

export const RD_ATTR  = 0;
export const RD_BIND = 1;
export const WR_BIND = 2;
export const ZCL_CMD  = 3;

export const SL_LIST_PORTS = 0;
export const SL_ATTR_SET = 1;
export const SL_SRC_BIND = 2;
export const SL_WR_BIND = 3;
export const SL_ZCL_CMD = 4;
export const SL_CLOSE_CMD = 5;

export const THERMOSTAT_HYSTERESIS = 0.5;

export const FREE_LIST_LEN = 12;
export const USED_LIST_LEN = 6;

export const dummyOnOff: gIF.on_off_actuator_t = {
    name: '- - - - -',
    valid: false,
    partNum: 0,
    addr: 0,
    endPoint: 0
}

export const dummyDesc: gIF.descVal_t[] = [
    {
        key: 'node:',
        value: '- - - - -'
    },
    {
        key: 'label:',
        value: '- - - - -'
    },
    {
        key: 'address:',
        value: '- - -'
    }
];

export const dumyScroll: gIF.scroll_t = {
    name: DUMMY_SCROLL,
    yPos: 0
}
/*
export const invalidBind: gIF.bind_t = {
    valid: false,
    partNum: 0,
    extAddr: 0,
    name: '- - -',
    clusterID: 0,
    shortAddr: 0,
    endPoint: 0
};
*/
/*
export const invalidHostedBind: gIF.hostedBind_t = {
    timestamp: 0,
    name: '- - -',
    partNum: 0,
    hostShortAddr: 0,
    extAddr: 0,
    srcShortAddr: 0,
    srcEP: 0,
    clusterID: 0,
    dstExtAddr: 0,
    dstEP: 0
};
*/
export const invalidStat = {
    name: '- - -',
    partNum: 0,
    setPoint: 0,
    prevSetPoint: 0,
    workPoint: 0,
    hysteresis: 0,
    addr: 0,
    endPoint: 0,
    actuators: []
}



