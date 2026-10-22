import React from 'react';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { PetWidget } from './PetWidget';
import { loadSnapshot } from './widgetSync';

/** Runs in the background when Android adds, refreshes or resizes the widget. */
export async function widgetTaskHandler({ widgetAction, renderWidget }: WidgetTaskHandlerProps) {
  if (widgetAction === 'WIDGET_DELETED' || widgetAction === 'WIDGET_CLICK') return;
  renderWidget(React.createElement(PetWidget, { s: await loadSnapshot() }));
}
