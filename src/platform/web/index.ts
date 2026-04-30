import type { Platform } from '../index'
import { webCapabilities } from './Capabilities.web'
import { WebGridService } from './GridService.web'
import { WebAprsService } from './AprsService.web'
import { WebAudioService } from './AudioService.web'
import { WebBackgroundService } from './BackgroundService.web'
import { WebEventsService } from './EventsService.web'
import { WebStorageService } from './StorageService.web'

export function createWebPlatform(): Platform {
  return {
    events: new WebEventsService(),
    audio: new WebAudioService(),
    aprs: new WebAprsService(),
    grid: new WebGridService(),
    background: new WebBackgroundService(),
    storage: new WebStorageService(),
    capabilities: webCapabilities
  }
}
