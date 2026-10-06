import { OpsShell } from '@/components/ops/ops-shell'
import { MissionProvider } from '@/components/ops/store'

export default function Page() {
  return (
    <MissionProvider>
      <OpsShell />
    </MissionProvider>
  )
}
