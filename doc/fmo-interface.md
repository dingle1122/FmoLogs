# FMO 接口文档

本文仅整理当前已知的 FMO 设备接口信息。未确认的响应结构不写示例，避免把未确认内容写成接口事实。

## 1. 接口地址

| 用途 | 地址 |
| --- | --- |
| WebSocket RPC | `ws(s)://{host}/ws` |
| 实时事件流 | `ws(s)://{host}/events` |
| 音频流 | `ws(s)://{host}/audio` |
| 日志备份下载 | `http(s)://{host}/api/qso/backup` |
| 远程控制页面 | `http://{host}/remote.html` |

`{host}` 为 FMO 主机名、IP 或带端口地址，例如 `fmo.local`、`192.168.1.10`、`192.168.1.10:8080`。

## 2. WebSocket RPC 通用格式

地址：`ws(s)://{host}/ws`

请求格式：

```json
{
  "type": "qso",
  "subType": "getList",
  "data": {}
}
```

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `type` | string | 是 | 接口类型 |
| `subType` | string | 是 | 接口动作 |
| `data` | object | 是 | 请求参数，无参数时传 `{}` |

通用响应格式：

```json
{
  "type": "qso",
  "subType": "getListResponse",
  "data": {},
  "code": 0
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `type` | string | 接口类型 |
| `subType` | string | 响应动作 |
| `data` | object | 响应数据 |
| `code` | number | `0` 表示成功，非 `0` 表示失败 |

## 3. QSO 日志接口

### 3.1 获取日志列表

请求：

```json
{
  "type": "qso",
  "subType": "getList",
  "data": {
    "page": 0,
    "pageSize": 20
  }
}
```

请求参数：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `page` | number | 是 | 页码，从 `0` 开始 |
| `pageSize` | number | 是 | 每页数量 |

说明：`qso:getList` 没有 `fromCallsign` 请求参数。

响应：

```json
{
  "type": "qso",
  "subType": "getListResponse",
  "data": {
    "list": [
      {
        "logId": 172,
        "timestamp": 1779515130,
        "toCallsign": "BG2IKH",
        "grid": "PN23pu"
      },
      {
        "logId": 171,
        "timestamp": 1779514924,
        "toCallsign": "BG9JLV",
        "grid": "OM16up"
      }
    ],
    "page": 0,
    "pageSize": 20,
    "count": 20
  },
  "code": 0
}
```

响应字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `data.list` | array | 日志列表 |
| `data.page` | number | 当前页码 |
| `data.pageSize` | number | 每页数量 |
| `data.count` | number | 本次返回数量 |
| `data.list[].logId` | number | 日志 ID |
| `data.list[].timestamp` | number | 通联时间戳，单位秒 |
| `data.list[].toCallsign` | string | 对方呼号 |
| `data.list[].grid` | string | 对方 Maidenhead 网格 |

### 3.2 获取日志详情

请求：

```json
{
  "type": "qso",
  "subType": "getDetail",
  "data": {
    "logId": 165
  }
}
```

请求参数：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `logId` | number | 是 | 日志 ID |

响应：

```json
{
  "type": "qso",
  "subType": "getDetailResponse",
  "data": {
    "log": {
      "logId": 165,
      "timestamp": 1779458933,
      "freqHz": 1454500,
      "fromCallsign": "BH5HSJ",
      "fromGrid": "PM00ad",
      "toCallsign": "BH8RCX",
      "toGrid": "OL36io",
      "toComment": "爽爽贵阳,避暑天堂,感谢通联,73!",
      "mode": "FMO",
      "relayName": "甘肃御花园",
      "relayAdmin": "BG9JQD"
    }
  },
  "code": 0
}
```

响应字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `data.log` | object | 日志详情 |
| `logId` | number | 日志 ID |
| `timestamp` | number | 通联时间戳，单位秒 |
| `freqHz` | number | 频率值 |
| `fromCallsign` | string | 发起方呼号 |
| `fromGrid` | string | 发起方 Maidenhead 网格 |
| `toCallsign` | string | 对方呼号 |
| `toGrid` | string | 对方 Maidenhead 网格 |
| `toComment` | string | 对方备注或留言 |
| `mode` | string | 通联模式 |
| `relayName` | string | 中继或服务器名称 |
| `relayAdmin` | string | 中继或服务器管理员呼号 |

## 4. Station 台站接口

### 4.1 获取台站列表

请求：

```json
{
  "type": "station",
  "subType": "getListRange",
  "data": {
    "start": 0,
    "count": 20
  }
}
```

请求参数：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `start` | number | 是 | 起始位置 |
| `count` | number | 是 | 获取数量 |

响应：

```json
{
  "type": "station",
  "subType": "getListResponse",
  "data": {
    "list": [
      {
        "uid": 159,
        "name": "语音实验室"
      },
      {
        "uid": 1845,
        "name": "吴江FMO频道"
      }
    ],
    "count": 20
  },
  "code": 0
}
```

响应字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `data.list` | array | 台站列表 |
| `data.count` | number | 本次返回数量 |
| `data.list[].uid` | number | 台站 ID |
| `data.list[].name` | string | 台站名称 |

### 4.2 获取置顶台站列表

请求：

```json
{
  "type": "station",
  "subType": "getPinnedList",
  "data": {
    "start": 0,
    "count": 10
  }
}
```

请求参数：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `start` | number | 是 | 起始位置 |
| `count` | number | 是 | 获取数量 |

响应：

```json
{
  "type": "station",
  "subType": "getPinnedListResponse",
  "data": {
    "list": [
      {
        "uid": 159,
        "name": "语音实验室"
      },
      {
        "uid": 531,
        "name": "半间猫窝(洛)"
      }
    ],
    "count": 6
  },
  "code": 0
}
```

响应字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `data.list` | array | 置顶台站列表 |
| `data.count` | number | 本次返回数量 |
| `data.list[].uid` | number | 台站 ID |
| `data.list[].name` | string | 台站名称 |

### 4.3 获取当前台站

请求：

```json
{
  "type": "station",
  "subType": "getCurrent",
  "data": {}
}
```

响应：

```json
{
  "type": "station",
  "subType": "getCurrentResponse",
  "data": {
    "uid": 447,
    "name": "如意甘肃"
  },
  "code": 0
}
```

响应字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `uid` | number | 台站 ID |
| `name` | string | 台站名称 |

### 4.4 设置当前台站

请求：

```json
{
  "type": "station",
  "subType": "setCurrent",
  "data": {
    "uid": 1
  }
}
```

请求参数：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `uid` | number | 是 | 台站 ID |

响应：

```json
{
  "type": "station",
  "subType": "setCurrentResponse",
  "data": {
    "result": 0
  },
  "code": 0
}
```

响应字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `data.result` | number | 操作结果，`0` 表示成功 |

### 4.5 切换台站

下一个台站：

```json
{
  "type": "station",
  "subType": "next",
  "data": {}
}
```

上一个台站：

```json
{
  "type": "station",
  "subType": "prev",
  "data": {}
}
```

响应：

```json
{
  "type": "station",
  "subType": "nextResponse",
  "data": {
    "result": 0
  },
  "code": 0
}
```

```json
{
  "type": "station",
  "subType": "prevResponse",
  "data": {
    "result": 0
  },
  "code": 0
}
```

响应字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `data.result` | number | 操作结果，`0` 表示成功 |

## 5. 用户信息接口

请求：

```json
{
  "type": "user",
  "subType": "getInfo",
  "data": {}
}
```

响应 `subType`：`getInfoResponse`

响应：

```json
{
  "type": "user",
  "subType": "getInfoResponse",
  "data": {
    "callsign": "BH5HSJ",
    "uid": 159,
    "wlanIP": "115.197.138.191"
  },
  "code": 0
}
```

响应字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `callsign` | string | 用户呼号 |
| `uid` | number | 用户 ID |
| `wlanIP` | string | FMO WLAN IP |

## 6. 坐标配置接口

接口名中的 `Cordinate` 按当前已知 FMO 接口拼写记录。

### 6.1 获取坐标

请求：

```json
{
  "type": "config",
  "subType": "getCordinate",
  "data": {}
}
```

响应：

```json
{
  "type": "config",
  "subType": "getCordinateResponse",
  "data": {
    "latitude": 30.154545721857474,
    "longitude": 120.08122820726791
  },
  "code": 0
}
```

响应字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `latitude` | number | 纬度 |
| `longitude` | number | 经度 |

### 6.2 设置坐标

请求：

```json
{
  "type": "config",
  "subType": "setCordinate",
  "data": {
    "latitude": 30.123456,
    "longitude": 120.123456
  }
}
```

请求参数：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `latitude` | number | 是 | 纬度 |
| `longitude` | number | 是 | 经度 |

响应：

```json
{
  "type": "config",
  "subType": "setCordinateResponse",
  "data": {
    "result": 0
  },
  "code": 0
}
```

响应字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `data.result` | number | 操作结果，`0` 表示成功 |

## 7. 消息接口

### 7.1 获取消息列表

请求：

```json
{
  "type": "message",
  "subType": "getList",
  "data": {
    "pageSize": 20,
    "anchorId": 0
  }
}
```

请求参数：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `pageSize` | number | 是 | 每页数量 |
| `anchorId` | number | 是 | 分页锚点，首次请求传 `0` |

响应：

```json
{
  "type": "message",
  "subType": "getListResponse",
  "data": {
    "list": [
      {
        "messageId": 10,
        "from": "BH7HCU-7",
        "timestamp": 1778759149,
        "isRead": 1
      },
      {
        "messageId": 9,
        "from": "BH7HCU-7",
        "timestamp": 1778750232,
        "isRead": 1
      }
    ],
    "anchorId": 0,
    "nextAnchorId": 1,
    "page": 0,
    "pageSize": 20,
    "count": 4
  },
  "code": 0
}
```

响应字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `data.list` | array | 消息列表 |
| `data.anchorId` | number | 当前分页锚点 |
| `data.nextAnchorId` | number | 下一页分页锚点 |
| `data.page` | number | 当前页码 |
| `data.pageSize` | number | 每页数量 |
| `data.count` | number | 本次返回数量 |
| `data.list[].messageId` | number | 消息 ID |
| `data.list[].from` | string | 发送方呼号 |
| `data.list[].timestamp` | number | 消息时间戳，单位秒 |
| `data.list[].isRead` | number | 已读状态，`1` 表示已读 |

### 7.2 获取消息详情

请求：

```json
{
  "type": "message",
  "subType": "getDetail",
  "data": {
    "messageId": 10
  }
}
```

请求参数：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `messageId` | number | 是 | 消息 ID |

响应：

```json
{
  "type": "message",
  "subType": "getDetailResponse",
  "data": {
    "message": {
      "messageId": 10,
      "timestamp": 1778759149,
      "isRead": 1,
      "lat": 0,
      "lon": 0,
      "from": "BH7HCU-7",
      "to": "BH5HSJ-2",
      "path": "TCPIP*,qAC,T2TAIPEI",
      "rig": "APRS",
      "message": "哈哈"
    }
  },
  "code": 0
}
```

响应字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `data.message` | object | 消息详情 |
| `messageId` | number | 消息 ID |
| `timestamp` | number | 消息时间戳，单位秒 |
| `isRead` | number | 已读状态，`1` 表示已读 |
| `lat` | number | 纬度 |
| `lon` | number | 经度 |
| `from` | string | 发送方呼号 |
| `to` | string | 接收方呼号 |
| `path` | string | 消息路径 |
| `rig` | string | 消息来源或制式 |
| `message` | string | 消息内容 |

### 7.3 标记消息已读

请求：

```json
{
  "type": "message",
  "subType": "setRead",
  "data": {
    "messageId": 10
  }
}
```

请求参数：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `messageId` | number | 是 | 消息 ID |

响应（按现有接口规律推断）：

```json
{
  "type": "message",
  "subType": "setReadResponse",
  "data": {
    "result": 0
  },
  "code": 0
}
```

响应字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `data.result` | number | 操作结果，`0` 表示成功 |

### 7.4 发送消息

请求：

```json
{
  "type": "message",
  "subType": "send",
  "data": {
    "callsign": "BH5YYY",
    "ssid": 1,
    "message": "hello"
  }
}
```

请求参数：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `callsign` | string | 是 | 目标呼号 |
| `ssid` | number | 是 | 目标 SSID |
| `message` | string | 是 | 消息内容 |

响应（按现有接口规律推断）：

```json
{
  "type": "message",
  "subType": "sendResponse",
  "data": {
    "result": 0
  },
  "code": 0
}
```

响应字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `data.result` | number | 操作结果，`0` 表示成功 |

### 7.5 删除消息

删除单条：

```json
{
  "type": "message",
  "subType": "deleteItem",
  "data": {
    "messageId": 10
  }
}
```

删除全部：

```json
{
  "type": "message",
  "subType": "deleteAll",
  "data": {}
}
```

响应（按现有接口规律推断）：

```json
{
  "type": "message",
  "subType": "deleteItemResponse",
  "data": {
    "result": 0
  },
  "code": 0
}
```

```json
{
  "type": "message",
  "subType": "deleteAllResponse",
  "data": {
    "result": 0
  },
  "code": 0
}
```

响应字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `data.result` | number | 操作结果，`0` 表示成功 |

## 8. 实时事件接口

地址：`ws(s)://{host}/events`

传输：WebSocket 文本消息

### 8.1 发言状态事件

```json
{
  "type": "qso",
  "subType": "callsign",
  "data": {
    "callsign": "BH5YYY",
    "isSpeaking": true,
    "isHost": false,
    "grid": "OL89"
  }
}
```

字段说明：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `callsign` | string | 当前发言呼号 |
| `isSpeaking` | boolean | 是否正在发言 |
| `isHost` | boolean | 是否为 host 发言 |
| `grid` | string | Maidenhead 网格 |

### 8.2 历史发言记录事件

```json
{
  "type": "qso",
  "subType": "history",
  "level": "info",
  "seq": 11441,
  "ts": 155136634,
  "src": "qso",
  "data": [
    {
      "callsign": "BH6RYC",
      "utcTime": 1779536547
    },
    {
      "callsign": "BG7LTK",
      "utcTime": 1779536533
    },
    {
      "callsign": "BH9BGW",
      "utcTime": 1779536522
    },
    {
      "callsign": "BG7LTK",
      "utcTime": 1779536514
    },
    {
      "callsign": "BH6RYC",
      "utcTime": 1779536503
    },
    {
      "callsign": "BG7LTK",
      "utcTime": 1779536495
    },
    {
      "callsign": "BH6RYC",
      "utcTime": 1779536488
    },
    {
      "callsign": "BG7LTK",
      "utcTime": 1779536480
    },
    {
      "callsign": "BH6RYC",
      "utcTime": 1779536468
    },
    {
      "callsign": "BG7LTK",
      "utcTime": 1779536458
    },
    {
      "callsign": "BH6RYC",
      "utcTime": 1779536442
    },
    {
      "callsign": "BG7LTK",
      "utcTime": 1779536422
    },
    {
      "callsign": "BH6RYC",
      "utcTime": 1779536409
    },
    {
      "callsign": "BG7LTK",
      "utcTime": 1779536392
    },
    {
      "callsign": "BH6RYC",
      "utcTime": 1779536381
    },
    {
      "callsign": "BG7LTK",
      "utcTime": 1779536357
    },
    {
      "callsign": "BH6RYC",
      "utcTime": 1779536338
    },
    {
      "callsign": "BI1JOJ",
      "utcTime": 1779536287
    },
    {
      "callsign": "BD1CGP",
      "utcTime": 1779536183
    },
    {
      "callsign": "BA3MPZ",
      "utcTime": 1779536104
    }
  ]
}
```

字段说明：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `type` | string | 固定为 `qso` |
| `subType` | string | 固定为 `history` |
| `level` | string | 消息级别 |
| `seq` | number | 消息序号 |
| `ts` | number | 事件时间戳 |
| `src` | string | 消息来源 |
| `data` | array | 历史发言记录列表 |
| `data[].callsign` | string | 发言呼号 |
| `data[].utcTime` | number | 发言 UTC 时间戳，单位秒 |

## 9. 音频流接口

| 项 | 内容 |
| --- | --- |
| 地址 | `ws(s)://{host}/audio` |
| 传输 | WebSocket 二进制消息 |
| 数据格式 | PCM |
| 采样率 | 8000 Hz |
| 声道 | 单声道 |
| 位深 | 16-bit signed little-endian |

## 10. 日志备份下载接口

| 项 | 内容 |
| --- | --- |
| 地址 | `http(s)://{host}/api/qso/backup` |
| 方法 | GET |
| 响应 | FMO 日志数据库文件 |

## 11. 远程控制页面

| 项 | 内容 |
| --- | --- |
| 地址 | `http://{host}/remote.html` |
| 方法 | GET |
| 响应 | FMO 远程控制页面 |
