import React from 'react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const shortcuts = [
    { category: 'ツール', items: [
      { key: '1', description: 'ペンツール' },
      { key: '2', description: '消しゴムツール' },
      { key: '3', description: 'テキストツール' },
      { key: '4', description: 'ラインツール' },
      { key: '5', description: '選択ツール' },
      { key: '右クリック', description: 'ペン⇔消しゴム切り替え' },
    ]},
    { category: 'ナビゲーション', items: [
      { key: 'PageUp / ←', description: '前のページ' },
      { key: 'PageDown / →', description: '次のページ' },
      { key: 'Home', description: '最初のページ' },
      { key: 'End', description: '最後のページ' },
      { key: '3本指ダブルタップ', description: 'ページ移動（上半分=前、下半分=次）' },
    ]},
    { category: 'ズーム操作', items: [
      { key: 'Ctrl + +', description: '拡大' },
      { key: 'Ctrl + -', description: '縮小' },
      { key: 'Ctrl + 0', description: 'ズームリセット' },
      { key: '4本指ピンチ', description: '拡大・縮小（指の中心基準）' },
      { key: '5本指ダブルタップ', description: '幅に合わせる' },
    ]},
    { category: 'PDF移動', items: [
      { key: '↑↓←→', description: 'スクロール' },
      { key: '選択ツール + ドラッグ', description: 'PDF移動' },
      { key: '3本指スワイプ', description: 'PDF移動（全モード対応）' },
    ]},
    { category: '編集', items: [
      { key: 'Ctrl + Z', description: '元に戻す' },
      { key: 'Ctrl + Y', description: 'やり直し' },
      { key: 'Ctrl + S', description: '保存' },
      { key: 'Ctrl + O', description: '読み込み' },
      { key: 'Delete', description: '選択したアノテーション削除' },
    ]},
    { category: '表示', items: [
      { key: 'F11 / ⛶ボタン', description: '全画面表示' },
      { key: 'Tab', description: 'ページ番号入力フォーカス' },
    ]},
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl max-h-[80vh] overflow-auto m-4">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">PDFMark ヘルプ - ショートカットキー</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            title="閉じる"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="p-6">
          <div className="grid md:grid-cols-2 gap-6">
            {shortcuts.map((category) => (
              <div key={category.category} className="space-y-3">
                <h3 className="text-lg font-medium text-blue-800 border-b border-blue-200 pb-1">
                  {category.category}
                </h3>
                <div className="space-y-2">
                  {category.items.map((shortcut, index) => (
                    <div key={index} className="flex items-center justify-between py-1">
                      <span className="text-sm text-gray-600 flex-1">{shortcut.description}</span>
                      <kbd className="ml-4 px-2 py-1 bg-gray-100 border border-gray-300 rounded text-xs font-mono text-gray-800 whitespace-nowrap">
                        {shortcut.key}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-6 pt-4 border-t border-gray-200">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-medium text-blue-800 mb-2">💡 タッチペン使用時のヒント</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• タッチペンでの描画中の誤操作を防ぐため、ナビゲーションやズームは3本指以上のジェスチャーに変更されています</li>
                <li>• 2本指ピンチは無効化され、4本指ピンチでズームします</li>
                <li>• 右クリックでペンと消しゴムを素早く切り替えできます</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};