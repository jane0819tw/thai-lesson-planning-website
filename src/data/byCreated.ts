// 影片、歌曲列表依建立順序排列（createdAt 舊的在前；沒填的排最後，同日再依 id）
export function byCreated(a: { id: string; createdAt?: string }, b: { id: string; createdAt?: string }) {
  return (a.createdAt ?? '9999').localeCompare(b.createdAt ?? '9999') || a.id.localeCompare(b.id)
}
