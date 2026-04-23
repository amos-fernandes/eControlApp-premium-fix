import * as Location from 'expo-location'
import * as TaskManager from 'expo-task-manager'
import { insertDeviceLocation } from '../databases/database'

const LOCATION_TRACKING_TASK = 'location-tracking-task'

/**
 * Solicita as permissões de localização necessárias (Foreground e Background).
 */
export const requestLocationPermissions = async () => {
    const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync()
    if (foregroundStatus !== 'granted') {
        console.warn('[LocationManager] Permissão de localização em primeiro plano negada.')
        return false
    }

    const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync()
    if (backgroundStatus !== 'granted') {
        console.warn('[LocationManager] Permissão de localização em segundo plano negada.')
        // Não retorna false aqui pois o app ainda pode funcionar em primeiro plano
    }

    return true
}

/**
 * Captura a localização atual do dispositivo de forma pontual.
 */
export const getCurrentPosition = async () => {
    try {
        const hasPermission = await requestLocationPermissions()
        if (!hasPermission) return null

        const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
        })

        return location.coords
    } catch (error) {
        console.error('[LocationManager] Erro ao capturar posição atual:', error)
        return null
    }
}

/**
 * Inicia o rastreamento contínuo em segundo plano.
 */
export const startBackgroundTracking = async () => {
    try {
        const hasPermission = await requestLocationPermissions()
        if (!hasPermission) return

        const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TRACKING_TASK)
        if (isRegistered) {
            console.log('[LocationManager] Tarefa de rastreamento já registrada.')
            return
        }

        await Location.startLocationUpdatesAsync(LOCATION_TRACKING_TASK, {
            accuracy: Location.Accuracy.Balanced,
            distanceInterval: 500, // 500 metros
            timeInterval: 300000, // 5 minutos (300.000 ms)
            deferredUpdatesInterval: 300000,
            foregroundService: {
                notificationTitle: 'Rastreamento eControle',
                notificationBody: 'O app está rastreando a rota do veículo em tempo real.',
                notificationColor: '#0D2E1C',
            },
        })

        console.log('[LocationManager] Rastreamento em segundo plano iniciado.')
    } catch (error) {
        console.error('[LocationManager] Erro ao iniciar rastreamento:', error)
    }
}

/**
 * Para o rastreamento em segundo plano.
 */
export const stopBackgroundTracking = async () => {
    try {
        const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TRACKING_TASK)
        if (isRegistered) {
            await Location.stopLocationUpdatesAsync(LOCATION_TRACKING_TASK)
            console.log('[LocationManager] Rastreamento parado.')
        }
    } catch (error) {
        console.error('[LocationManager] Erro ao parar rastreamento:', error)
    }
}

/**
 * Define a tarefa que processará as atualizações de localização em segundo plano.
 * DEVE ser chamado no nível raiz do app (ex: app/_layout.tsx).
 */
export const defineLocationTask = () => {
    TaskManager.defineTask(LOCATION_TRACKING_TASK, ({ data, error }: any) => {
        if (error) {
            console.error('[LocationManager] Erro na tarefa de localização:', error)
            return
        }
        if (data) {
            const { locations } = data
            locations.forEach((loc: any) => {
                const { latitude, longitude, speed, heading, accuracy } = loc.coords
                insertDeviceLocation({
                    latitude,
                    longitude,
                    speed,
                    heading,
                    accuracy,
                    timestamp: new Date(loc.timestamp).toISOString(),
                })
                console.log(`[LocationManager] Localização salva: ${latitude}, ${longitude}`)
            })
        }
    })
}
