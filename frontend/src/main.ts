import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import router from './router'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import en from 'element-plus/es/locale/lang/en'
import 'element-plus/dist/index.css'
import i18n, { getLocale } from './i18n'

const app = createApp(App)

app.use(router)
app.use(i18n)

// Element Plus locale follows i18n locale
const elLocale = getLocale() === 'zh-CN' ? zhCn : en
app.use(ElementPlus, { locale: elLocale })

app.mount('#app')
