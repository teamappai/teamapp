"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import type { SectionRow } from "@/lib/team/sections";
import type { ModuleRow } from "@/lib/team/modules";
import type { DealType, DealStage, RequestType } from "@/lib/team/config";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HUB_TABS, type HubTab } from "@/lib/team/hub-tabs";
import { SectionsTab } from "@/components/team/sections-tab";
import { ModulesTab } from "@/components/team/modules-tab";
import {
  DealTypesTab,
  DealStagesTab,
  RequestTypesTab,
} from "@/components/team/config-tabs";

export function ManagementHub({
  companyId,
  activeTab,
  sections,
  modules,
  dealTypes,
  dealStages,
  requestTypes,
}: {
  companyId: string;
  activeTab: HubTab;
  sections: SectionRow[];
  modules: ModuleRow[];
  dealTypes: DealType[];
  dealStages: DealStage[];
  requestTypes: RequestType[];
}) {
  const router = useRouter();

  function onTabChange(value: string) {
    // Sub-tabs live in a search param, not a route — keeps the URL clean and
    // the layout stable across sub-tabs.
    router.replace(`/app/management?tab=${value}`, { scroll: false });
  }

  return (
    <Tabs value={activeTab} onValueChange={onTabChange}>
      <TabsList>
        {HUB_TABS.map((t) => (
          <TabsTrigger key={t.value} value={t.value}>
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="sections">
        <SectionsTab sections={sections} />
      </TabsContent>
      <TabsContent value="modules">
        <ModulesTab
          modules={modules}
          sections={sections}
          companyId={companyId}
        />
      </TabsContent>
      <TabsContent value="deal-types">
        <DealTypesTab dealTypes={dealTypes} />
      </TabsContent>
      <TabsContent value="deal-stages">
        <DealStagesTab dealStages={dealStages} companyId={companyId} />
      </TabsContent>
      <TabsContent value="request-types">
        <RequestTypesTab requestTypes={requestTypes} />
      </TabsContent>
    </Tabs>
  );
}
