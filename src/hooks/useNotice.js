import { useEffect, useState } from 'react'

// Un aviso breve (por ejemplo «3 fotos enviadas») que desaparece solo
export function useNotice() {
  const [notice, setNotice] = useState(null)

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(null), 4500)
    return () => clearTimeout(timer)
  }, [notice])

  return [notice, setNotice]
}
