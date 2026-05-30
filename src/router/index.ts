import { createRouter, createWebHistory } from 'vue-router'
//vue-router という外部パッケージから、ルーターを作成するための createRouter 関数と、ブラウザの履歴を管理する createWebHistory 関数を読み込んでいる
import HomeView from '@/views/HomeView.vue'
//自作したコンポーネントのインポート。@はルートディレクトリ
import WorkDetailView from '@/views/WorkDetailView.vue'
import CharacterDetailView from '@/views/CharacterDetailView.vue'

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
    {
      //:idは動的セグメント。変数として扱う。1とか2とかに置き換えられる。　
      path: '/works/:id',
      name: 'work-detail',
      component: WorkDetailView,
      //props...親(使う側)から子に渡すデータ
      props: true,
    },
    {
      path: '/works/:workId/characters/:characterId',
      name: 'character-detail',
      component: CharacterDetailView,
      props: true,
    },
  ],
})

export default router