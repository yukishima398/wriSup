import { createRouter, createWebHistory } from 'vue-router'
//vue-router という外部パッケージから、ルーターを作成するための createRouter 関数と、ブラウザの履歴を管理する createWebHistory 関数を読み込んでいる
import HomeView from '@/views/HomeView.vue'
//自作したコンポーネントのインポート。@はルートディレクトリ

const router = createRouter({
  //URLが切り替わってもページ全体のリロード（再読み込み）が発生しないように制御する
  history: createWebHistory(),
  routes: [
    //URLと表示コンポーネントの対応づけを行っている
    //トップページ（/'）にアクセスしたときに、さっきインポートした HomeView を表示する
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
  ],
})

export default router